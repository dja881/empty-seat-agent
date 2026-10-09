import { NextResponse } from "next/server";
import { db, MERCHANT_ID, must } from "@/lib/server/db";
import { loadDay, timeLabel } from "@/lib/server/day";
import { istDayRange, istMinutes } from "@/lib/time";

interface PaidOffer {
  id: string; status: string; customer_id: string; guest_name: string | null; service_id: string; chair: number; start_at: string;
  list_price: number; price: number; funded_amount: number; merchant_net: number; offer_type: string; wave: number;
  customers: { name: string } | null; services: { name: string } | null;
}

/** Screen 5: everything the end-of-day report shows, computed from today's rows. */
export async function GET() {
  const day = await loadDay();
  const { from, to } = istDayRange(day.demo.demo_date);
  const [offersRes, paymentsRes, eventsRes, benchRes, histRes] = await Promise.all([
    db.from("offers").select("*, customers(name), services(name)").gte("start_at", from).lt("start_at", to),
    db.from("payments").select("offer_id, razorpay_payment_id, amount, status, captured_at"),
    db.from("events").select("type, payload").eq("merchant_id", MERCHANT_ID),
    db.from("network_benchmarks").select("*").eq("city", "Hyderabad").eq("service", "Haircut").eq("day_part", "afternoon").eq("lead_time", "same_day").single(),
    db.rpc("walkin_profile", { p_merchant: MERCHANT_ID, p_date: day.demo.demo_date }),
  ]);
  const offers = must(offersRes, "offers") as PaidOffer[];
  const payments = must(paymentsRes, "payments") as { offer_id: string; razorpay_payment_id: string; amount: number; status: string; captured_at: string }[];
  const events = must(eventsRes, "events") as { type: string; payload: Record<string, unknown> }[];
  const bench = benchRes.data as { fill_rate: number; merchant_count: number } | null;

  const paid = offers.filter((o) => o.status === "paid").sort((a, b) => a.start_at.localeCompare(b.start_at));
  const plan = day.demo.plan;
  const released = (plan?.releasedUnits ?? 22) + (events.some((e) => e.type === "footfall_alert") ? 1 : 0);
  const recovered = paid.reduce((n, o) => n + o.merchant_net, 0);
  const discount = paid.reduce((n, o) => n + (o.list_price - o.merchant_net), 0);
  const funded = paid.reduce((n, o) => n + o.funded_amount, 0);
  const newCustomers = paid.filter((o) => o.guest_name).length;
  const walkIns = events.filter((e) => e.type === "walk_in").length;
  const callMe = events.filter((e) => e.type === "call_me").length;
  const sent = offers.length;
  const fill = paid.length / Math.max(released, 1);

  // Learning: walk-ins predicted for the held hours vs those that came.
  const profile = new Map((must(histRes, "profile") as { hour: number; avg_walkins: number }[]).map((r) => [r.hour, Number(r.avg_walkins)]));
  const at4 = Math.round((profile.get(16) ?? 0) * (1 + (plan?.footfallPct ?? 0) / 100));
  // Compare walk-ins with the forecast for the same held window ("3 to 6 pm").
  const m = (plan?.heldHours ?? "3 to 6 pm").match(/(\d+)(?::\d+)?\s*(?:am|pm)?\s*to\s*(\d+)/);
  const toH = (h: number) => (h < 9 ? h + 12 : h);
  const [h0, h1] = m ? [toH(Number(m[1])), toH(Number(m[2]))] : [15, 18];
  let windowForecast = 0;
  for (let h = h0; h < h1; h++) windowForecast += (profile.get(h) ?? 0) * (1 + (plan?.footfallPct ?? 0) / 100);
  windowForecast = Math.round(windowForecast);
  const windowActual = events.filter((e) => {
    if (e.type !== "walk_in") return false;
    const hh = String(e.payload.start).match(/(\d+)/);
    return hh ? toH(Number(hh[1])) >= h0 && toH(Number(hh[1])) < h1 : false;
  }).length;
  const holdChange = windowForecast - windowActual;
  const hdfcTaken = paid.filter((o) => o.funded_amount > 0).length;

  return NextResponse.json({
    clock: timeLabel(day.now),
    recovered, sold: paid.length, released, fill, discount, funded, newCustomers, walkIns, callMe, sent,
    frontDesk: events.filter((e) => e.type === "front_desk_booked").length,
    benchmark: bench ? { you: fill, nearby: Number(bench.fill_rate), merchants: bench.merchant_count } : null,
    learnings: [
      `Walk-ins ${plan?.heldHours ?? "3 to 6 pm"}: ${windowActual} came vs ${windowForecast} forecast. ${holdChange >= 2 ? `Holding ${holdChange - 1} fewer next Tuesday.` : holdChange <= -2 ? "Holding one more next Tuesday." : "Keeping the same hold next Tuesday."}`,
      `HDFC offer used on ${hdfcTaken} of ${paid.length} paid slots. ${hdfcTaken >= 2 ? "Leading with it for HDFC cardholders." : "Showing it only when it fits."}`,
      `4 pm walk-ins forecast ${at4}; footfall ran ${Math.abs(plan?.footfallPct ?? 0)}% below normal all day.`,
    ],
    weekly: "Tuesday 2 to 5 pm has been mostly empty for 4 weeks in a row. Offer an off-peak pass on UPI Autopay to customers who already come in on weekday afternoons.",
    payments: paid.map((o) => {
      const p = payments.find((x) => x.offer_id === o.id);
      return {
        time: timeLabel(istMinutes(o.start_at)),
        customer: o.guest_name ?? o.customers?.name,
        isNew: !!o.guest_name,
        service: o.services?.name,
        chair: o.chair,
        amount: o.merchant_net,
        paidByCustomer: o.merchant_net - o.funded_amount,
        offer: o.funded_amount > 0 ? `HDFC ₹${o.funded_amount}` : o.guest_name ? "Friend" : o.wave > 1 ? "Wave 2" : "Pay now",
        status: p?.status === "simulated" ? "Captured (sim)" : p?.status === "refunded" ? "Refunded" : "Captured",
        paymentId: p?.razorpay_payment_id?.startsWith("pay_") ? p.razorpay_payment_id : null,
      };
    }),
  });
}

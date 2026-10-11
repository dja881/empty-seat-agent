import { NextResponse } from "next/server";
import { db, MERCHANT_ID, must } from "@/lib/server/db";
import { loadDay, timeLabel } from "@/lib/server/day";
import { emptySlotCount } from "@/lib/slots";
import type { Slot } from "@/lib/types";
import { istDayRange, istMinutes } from "@/lib/time";

// Report assumptions (would live in Agent settings in the product).
const AGENT_FEE = 0.08;            // success fee on slots the agent sells
const MONTHLY_BUDGET = 10000;      // salon-funded discounts the owner allows per month
// Salon-funded discount on earlier agent days this month (synthetic history).
const EARLIER_DAYS: [string, number][] = [["2 Oct", 520], ["5 Oct", 380], ["6 Oct", 610], ["9 Oct", 540], ["12 Oct", 600]];
const WEEKDAYS_SO_FAR = 9;         // 1 to 13 Oct
const WEEKDAYS_LEFT = 13;          // 14 to 30 Oct

interface OfferRow {
  id: string; status: string; customer_id: string; guest_name: string | null; chair: number; start_at: string;
  list_price: number; price: number; funded_amount: number; merchant_net: number; funder: string | null; funder_kind: string | null;
  customers: { name: string; last_visit_at: string; usual_gap_days: number } | null; services: { name: string } | null;
}

/** Chance this customer would have booked today without an offer, with the reason shown to the owner. */
function baseline(o: OfferRow, today: number): { p: number; why: string } {
  if (o.guest_name || !o.customers) return { p: 0, why: "first visit" };
  const days = Math.round((today - new Date(o.customers.last_visit_at).getTime()) / 86400000);
  const due = days / o.customers.usual_gap_days;
  if (due >= 2) return { p: 0.1, why: `lapsed ${Math.max(2, Math.round(days / 30))} months` };
  if (due >= 1.1) return { p: 0.2, why: `overdue, usually visits every ${Math.round(o.customers.usual_gap_days / 7)} weeks` };
  return { p: 0.4, why: "due about now, may have booked anyway" };
}

// "Riya Reddy" -> "Riya R."; guests ("Riya's guest") stay as they are.
const shortName = (n: string) => { if (n.includes("'s ")) return n; const [a, b] = n.split(" "); return b ? `${a} ${b[0]}.` : a; };

/** The day report: every number computed from today's rows. */
export async function GET() {
  const day = await loadDay();
  const { from, to } = istDayRange(day.demo.demo_date);
  const [offersRes, paymentsRes, eventsRes, benchRes, profileRes] = await Promise.all([
    db.from("offers").select("*, customers(name, last_visit_at, usual_gap_days), services(name)").gte("start_at", from).lt("start_at", to),
    db.from("payments").select("offer_id, razorpay_payment_id, status"),
    db.from("events").select("type, payload").eq("merchant_id", MERCHANT_ID),
    db.from("network_benchmarks").select("fill_rate").eq("city", "Hyderabad").eq("service", "Haircut").eq("day_part", "afternoon").eq("lead_time", "same_day").single(),
    db.rpc("walkin_profile", { p_merchant: MERCHANT_ID, p_date: day.demo.demo_date }),
  ]);
  const offers = must(offersRes, "offers") as OfferRow[];
  const payments = must(paymentsRes, "payments") as { offer_id: string; razorpay_payment_id: string | null; status: string }[];
  const events = must(eventsRes, "events") as { type: string; payload: Record<string, unknown> }[];
  const plan = day.demo.plan;
  const today = new Date(day.demo.clock_at).getTime();

  const bookings = offers.filter((o) => o.status === "paid").sort((a, b) => a.start_at.localeCompare(b.start_at)).map((o) => {
    const { p, why } = baseline(o, today);
    const rev = o.merchant_net;                       // what the salon receives
    const m = o.list_price - o.merchant_net;          // discount the salon funded
    const b = o.funded_amount;                        // discount a partner funded
    const exp = Math.round(rev * p);
    const fee = Math.round(rev * AGENT_FEE);
    const pay = payments.find((x) => x.offer_id === o.id);
    return {
      name: shortName(o.guest_name ?? o.customers?.name ?? "Customer"),
      service: o.services?.name ?? "", chair: `Chair ${o.chair}`, time: timeLabel(istMinutes(o.start_at)),
      list: o.list_price, m, b, src: !b ? "" : o.funder_kind === "brand" ? "brand offer" : "bank offer", funder: b ? o.funder : null, p, why,
      rev, exp, fee, extra: rev - exp - fee, paid: rev - b,
      pay: pay?.status === "front_desk" ? "At the counter" : b && o.funder_kind !== "brand" ? "Card" : "UPI",
    };
  });
  const sum = (k: "rev" | "exp" | "fee" | "extra" | "paid" | "m" | "b") => bookings.reduce((s, a) => s + a[k], 0);

  // The fee is charged on the day's booking revenue, so 8% of the total shown is the fee shown.
  const dayFee = Math.round(sum("rev") * AGENT_FEE);

  const released = (plan?.releasedUnits ?? 22) + (events.some((e) => e.type === "footfall_alert") ? 1 : 0);
  const sentTo = new Set(offers.map((o) => `${o.customer_id}|${o.guest_name ?? ""}`)).size;
  const nearbyFill = Number((benchRes.data as { fill_rate: number } | null)?.fill_rate ?? 0.18);

  // Budget: salon-funded discounts only. Partner-funded amounts don't count.
  const spentToday = sum("m");
  const spent = EARLIER_DAYS.reduce((s, [, v]) => s + v, 0) + spentToday;
  const reserved = offers.filter((o) => ["sent", "link_sent"].includes(o.status) && new Date(o.start_at).getTime() > today)
    .reduce((s, o) => s + (o.list_price - o.price), 0);
  const projected = Math.round((spent + (spent / WEEKDAYS_SO_FAR) * WEEKDAYS_LEFT) / 100) * 100;

  // Walk-ins: slots kept in the morning plan vs walk-ins that came, by hour of the kept window.
  const kept = plan?.heldUnits ?? 10;
  const profile = new Map((must(profileRes, "profile") as { hour: number; avg_walkins: number }[]).map((r) => [r.hour, Number(r.avg_walkins)]));
  const hours = [15, 16, 17];
  const weight = hours.reduce((s, h) => s + (profile.get(h) ?? 1), 0);
  const walkEvents = events.filter((e) => e.type === "walk_in");
  const hourOf = (label: string) => { const h = Number(String(label).match(/(\d+)/)?.[1] ?? 0); return h < 9 ? h + 12 : h; };
  const walk = hours.map((h) => ({
    label: `${h - 12}–${h - 11} pm`,
    kept: Math.round((kept * (profile.get(h) ?? 1)) / weight),
    came: walkEvents.filter((e) => hourOf(String(e.payload.start)) === h).length,
  }));
  const came = walkEvents.length;

  return NextResponse.json({
    clock: timeLabel(day.now),
    bookings,
    totals: {
      rev: sum("rev"), exp: sum("exp"), fee: dayFee, extra: sum("rev") - sum("exp") - dayFee, paid: sum("paid"), m: sum("m"), b: sum("b"),
      bank: bookings.filter((x) => x.src === "bank offer").reduce((s, x) => s + x.b, 0),
      brand: bookings.filter((x) => x.src === "brand offer").reduce((s, x) => s + x.b, 0),
    },
    sold: bookings.length, released, notConverted: Math.max(0, sentTo - bookings.length),
    nearbyTypical: Math.round(nearbyFill * released),
    openSlots: emptySlotCount(day.slots as unknown as Slot[]),
    feeRate: AGENT_FEE,
    budget: {
      limit: MONTHLY_BUDGET, spent, reserved, available: Math.max(0, MONTHLY_BUDGET - spent - reserved), projected,
      perDayLeft: Math.round((MONTHLY_BUDGET - spent - reserved) / WEEKDAYS_LEFT / 10) * 10,
      days: [...EARLIER_DAYS.map(([d, v]) => ({ label: d, value: v, today: false })), { label: "Today", value: spentToday, today: true }],
    },
    walkIns: { kept, came, byHour: walk, suggest: Math.min(kept, came + 1), window: plan?.heldHours ?? "3 to 6 pm" },
    openUnits: plan?.openUnits ?? 32,
  });
}

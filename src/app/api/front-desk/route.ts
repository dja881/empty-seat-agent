import { NextResponse } from "next/server";
import { db, logEvent, must } from "@/lib/server/db";
import { loadDay, sellableTimes, type CustomerRow } from "@/lib/server/day";
import { createOffer, postMessage, refreshOffered } from "@/lib/server/offers";
import { getOffer, settle, stillOpen } from "@/lib/server/settle";
import { istMinutes } from "@/lib/time";

/** Today's offers for the front desk, newest first. */
export async function GET() {
  const day = await loadDay();
  const offers = must(await db.from("offers").select("*, customers(name), services(name)").order("created_at", { ascending: false }), "offers") as
    { id: string; customer_id: string; guest_name: string | null; status: string; wave: number; chair: number; start_at: string; price: number; funded_amount: number; offer_type: string; services: { name: string }; customers: { name: string } }[];
  const calls = must(await db.from("events").select("payload, clock_at").eq("type", "call_me").order("created_at", { ascending: false }), "calls") as
    { payload: { customer_id?: string; customer?: string; reason?: string }; clock_at: string }[];
  const replied = new Set((must(await db.from("messages").select("customer_id").eq("sender", "customer"), "replies") as { customer_id: string }[]).map((m) => m.customer_id));
  const callFor = new Set(calls.map((c) => c.payload.customer_id));
  // One row per customer and time: the latest offer wins.
  const seen = new Set<string>();
  const rows = offers.filter((o) => { const k = `${o.customer_id}|${o.guest_name}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((o) => ({
      id: o.id, customer: o.guest_name ?? o.customers.name, customerId: o.customer_id, sub: o.guest_name ? `${o.customers.name.split(" ")[0]}'s guest` : `Wave ${o.wave}${o.funded_amount ? " · HDFC offer" : ""}`,
      service: o.services.name, start: istMinutes(o.start_at), chair: o.chair, stylist: day.merchant.stylists[o.chair - 1],
      price: o.price, status: callFor.has(o.customer_id) && o.status !== "paid" ? "call_me" : o.status === "link_sent" && replied.has(o.customer_id) ? "replied" : o.status,
    }));
  return NextResponse.json({ rows, calls: calls.map((c) => ({ ...c.payload, clock: c.clock_at })) });
}

/**
 * {op: "send_link", offerId}: Sneha resends the payment link from the front desk.
 * {op: "mark_booked", offerId}: the customer called and booked by phone at the same price;
 *   the slot locks exactly as if they had paid online.
 */
export async function POST(req: Request) {
  const { op, offerId } = await req.json();
  const day = await loadDay();
  let o = await getOffer(offerId);

  // An expired or lost offer gets a fresh one at the same price, at the same or nearest time.
  if (o.status !== "paid" && (o.status === "expired" || o.status === "cancelled" || !stillOpen(day, o))) {
    const customer = must(await db.from("customers").select("*").eq("id", o.customer_id).single(), "customer") as CustomerRow;
    const service = day.services.find((s) => s.id === o.service_id)!;
    const t = sellableTimes(day, service.duration_min, { includeHeld: true })
      .sort((a, b) => Math.abs(a.start - istMinutes(o.start_at)) - Math.abs(b.start - istMinutes(o.start_at)))[0];
    if (!t) return NextResponse.json({ error: "No open time left today" }, { status: 409 });
    const { offer } = await createOffer(day, { customer, service, chair: t.chairs[0], start: t.start, end: t.start + service.duration_min, price: o.price, wave: o.wave, guestName: o.guest_name });
    o = await getOffer(offer.id);
  }

  if (op === "send_link") {
    await db.from("offers").update({ status: "link_sent" }).eq("id", o.id);
    await postMessage(day, o.customer_id, "front_desk",
      `Hi, Sneha here from the front desk. Here's the link for ${o.services?.name.toLowerCase()} at the same price, ₹${o.price}.`,
      { links: [{ offer_id: o.id, label: `Pay ₹${o.price}` }] });
    await refreshOffered();
    await logEvent("front_desk_link", { customer: o.guest_name ?? o.customers?.name });
    return NextResponse.json({ ok: true });
  }

  if (op === "mark_booked") {
    const { result } = await settle(o.id, { orderId: null, paymentId: null, amount: o.price, funded: 0, simulated: true, channel: "front_desk" });
    if (result !== "paid") return NextResponse.json({ error: "Slot already taken" }, { status: 409 });
    await db.from("bookings").update({ source: "front_desk" }).eq("customer_id", o.customer_id).eq("start_at", o.start_at).eq("source", "agent");
    await db.from("payments").update({ status: "front_desk" }).eq("offer_id", o.id);
    await logEvent("front_desk_booked", { customer: o.guest_name ?? o.customers?.name, amount: o.price });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}

import "server-only";
import { db, logEvent, must } from "./db";
import { loadDay, sellableTimes, timeLabel, type Day } from "./day";
import { postMessage, refreshOffered } from "./offers";
import { refundPayment } from "./razorpay";
import { istMinutes } from "../time";

export interface OfferDetail {
  id: string; customer_id: string; guest_name: string | null; service_id: string; chair: number;
  start_at: string; end_at: string; price: number; funded_amount: number; funder: string | null;
  status: string; razorpay_order_id: string | null; group_id: string | null; wave: number; funder_kind: "bank" | "brand" | null;
  customers: { name: string; phone: string } | null;
  services: { name: string; duration_min: number } | null;
}

export async function getOffer(id: string) {
  return must(await db.from("offers").select("*, customers(name, phone), services(name, duration_min)")
    .eq("id", id).single(), "offer") as OfferDetail;
}

/**
 * The partner-funded amount on a payment. A brand offer always applies; a bank offer applies
 * only when the customer picks that bank's card at checkout (variant "bank").
 */
export function fundedFor(o: Pick<OfferDetail, "funded_amount" | "funder_kind">, variant: string) {
  return o.funder_kind === "brand" || variant === "bank" ? o.funded_amount : 0;
}

/**
 * The offers one payment covers: the offer itself, plus the other seats still open in its group
 * (a customer bringing a friend pays once for both). Lead seat first.
 */
export async function groupOf(o: OfferDetail): Promise<OfferDetail[]> {
  if (!o.group_id) return [o];
  const rows = must(await db.from("offers").select("*, customers(name, phone), services(name, duration_min)")
    .eq("group_id", o.group_id).in("status", ["sent", "link_sent"]), "group") as OfferDetail[];
  const rest = rows.filter((r) => r.id !== o.id).sort((a, b) => Number(!!a.guest_name) - Number(!!b.guest_name));
  return [o, ...rest];
}

/** Settle one payment against every seat it covers. Amounts come from the offers, never the caller. */
export async function settleGroup(offerId: string, p: { orderId: string | null; paymentId: string | null; variant: string; simulated: boolean }) {
  const seats = await groupOf(await getOffer(offerId));
  let first: Awaited<ReturnType<typeof settle>> | null = null;
  for (const [i, seat] of seats.entries()) {
    const funded = fundedFor(seat, p.variant);
    // One Razorpay payment, one payments row per seat: later seats carry the id with a seat suffix.
    const r = await settle(seat.id, {
      orderId: p.orderId, paymentId: p.paymentId && i > 0 ? `${p.paymentId}_seat${i + 1}` : p.paymentId,
      refundId: p.paymentId, amount: seat.price - funded, funded, simulated: p.simulated,
    });
    first ??= r;
    if (i === 0 && r.result === "duplicate") break; // already settled (webhook after Checkout)
  }
  return first!;
}

/** Is the offer's time still open on its chair? */
export function stillOpen(day: Day, o: OfferDetail) {
  const a = istMinutes(o.start_at), b = istMinutes(o.end_at);
  return day.slots.some((s) => s.chair === o.chair && istMinutes(s.start_at) <= a && istMinutes(s.end_at) >= b
    && ["released", "offered", "held", "free"].includes(s.state));
}

/** Nearest other open times for the same service, at the same price. */
export function alternatives(day: Day, o: OfferDetail, n = 3) {
  const a = istMinutes(o.start_at);
  const dur = o.services?.duration_min ?? 45;
  return sellableTimes(day, dur, { step: 30 })
    .filter((t) => t.start !== a)
    .sort((x, y) => Math.abs(x.start - a) - Math.abs(y.start - a))
    .slice(0, n)
    .sort((x, y) => x.start - y.start)
    .map((t) => ({ start: t.start, label: timeLabel(t.start), chair: t.chairs[0], stylist: day.merchant.stylists[t.chairs[0] - 1], price: o.price }));
}

/**
 * Settle a captured payment. First confirmed payment wins (enforced in the database);
 * a second payment for the same time is refunded and the customer is offered other times.
 */
export async function settle(offerId: string, p: {
  orderId: string | null; paymentId: string | null; amount: number; funded: number; simulated: boolean;
  channel?: "online" | "front_desk"; refundId?: string | null;
}) {
  const result = must(await db.rpc("settle_offer", {
    p_offer: offerId, p_order: p.orderId, p_payment: p.paymentId,
    p_amount: p.amount, p_funded: p.funded, p_simulated: p.simulated,
  }), "settle") as "paid" | "taken" | "duplicate";

  const day = await loadDay();
  const o = await getOffer(offerId);
  const who = o.guest_name ?? o.customers?.name ?? "Customer";
  const stylist = day.merchant.stylists[o.chair - 1];
  const when = timeLabel(istMinutes(o.start_at));

  if (result === "paid") {
    await postMessage(day, o.customer_id, p.channel === "front_desk" ? "front_desk" : "salon",
      p.channel === "front_desk"
        ? `Booked over the phone: ${o.services?.name.toLowerCase()} for ${who.split(" ")[0]} at ${when} today with ${stylist} (chair ${o.chair}), ₹${p.amount} at the counter. See you soon!`
        : `Booked. ${o.services?.name} for ${who.split(" ")[0]} at ${when} today with ${stylist}, chair ${o.chair}. ₹${p.amount} received through Razorpay. See you soon!`,
      { receipt: { offer_id: o.id, payment_id: p.paymentId } });
  }
  if (result === "taken") {
    if (p.paymentId && !p.simulated) {
      try {
        await refundPayment(p.refundId ?? p.paymentId, p.amount, "slot already booked");
        await db.from("payments").update({ status: "refunded" }).eq("razorpay_payment_id", p.paymentId);
      } catch (err) {
        console.error("refund failed", err);
      }
    }
    const alts = alternatives(day, o);
    await logEvent("refund", { customer: who, amount: p.amount, reason: "slot already booked" });
    await postMessage(day, o.customer_id, "salon",
      `Sorry, ${when} was booked a moment before your payment went through. Your ₹${p.amount} is being refunded. ` +
      (alts.length ? `I can do ${alts.map((a) => a.label).join(", ")} at the same price.` : "I've added you to the waitlist."));
    await refreshOffered();
  }
  return { result, offer: o };
}

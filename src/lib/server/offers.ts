import "server-only";
import { db, MERCHANT_ID, must } from "./db";
import { atMinutes, slotForChair, timeLabel, type CustomerRow, type Day, type ServiceRow } from "./day";
import { anyFunding, fundingFor } from "./pricing";

export interface LinkButton { offer_id: string; label: string }

/** Append a message to a customer's thread, stamped with the demo clock. */
export async function postMessage(day: Day, customerId: string, sender: "salon" | "customer" | "front_desk" | "system",
  body: string, payload: Record<string, unknown> = {}) {
  return must(await db.from("messages").insert({
    merchant_id: MERCHANT_ID, customer_id: customerId, sender, body,
    payload: { clock: day.demo.clock_at, ...payload },
  }).select().single(), "message");
}

/** One offer: a service at a time on a chair, at a validated price. */
export async function createOffer(day: Day, o: {
  customer: CustomerRow; service: ServiceRow; chair: number; start: number; end: number;
  price: number; wave: number; guestName?: string | null; groupId?: string | null; steps?: number;
}) {
  const slot = slotForChair(day, o.chair, o.start, o.end);
  if (!slot) throw new Error(`no open time on chair ${o.chair} at ${timeLabel(o.start)}`);
  // Any HDFC card can take the bank-funded price at checkout, not only the customer's known card.
  const funding = anyFunding(day, o.price);
  const row = must(await db.from("offers").insert({
    slot_id: slot.id,
    customer_id: o.customer.id,
    guest_name: o.guestName ?? null,
    group_id: o.groupId ?? null,
    service_id: o.service.id,
    wave: o.wave,
    offer_type: o.guestName ? "friend" : funding ? "bank_funded" : "pay_now",
    list_price: o.service.price,
    price: o.price,
    funded_amount: funding?.amount ?? 0,
    merchant_net: o.price,
    funder: funding?.funder ?? null,
    status: "sent",
    chair: o.chair,
    start_at: atMinutes(day.demo.demo_date, o.start),
    end_at: atMinutes(day.demo.demo_date, o.end),
    price_steps: o.steps ?? 0,
    expires_at: new Date(new Date(day.demo.clock_at).getTime() + 30 * 60000).toISOString(),
  }).select().single(), "offer");
  return { offer: row as { id: string; price: number; funded_amount: number }, funding };
}

/** Supersede a customer's open offers when the conversation moves to a new time or price. */
export async function cancelOpenOffers(customerId: string, exceptGroup?: string) {
  let q = db.from("offers").update({ status: "cancelled" }).eq("customer_id", customerId).in("status", ["sent", "link_sent"]);
  if (exceptGroup) q = q.neq("group_id", exceptGroup);
  must(await q, "cancel offers");
}

export async function refreshOffered() {
  must(await db.rpc("refresh_offered", { p_merchant: MERCHANT_ID }), "refresh offered");
}

const first = (name: string) => name.split(" ")[0];

/** The approved WhatsApp template for the first message of a wave. */
export function openerText(day: Day, c: CustomerRow, service: ServiceRow, start: number, price: number) {
  const weeks = Math.max(1, Math.round((new Date(day.demo.clock_at).getTime() - new Date(c.last_visit_at).getTime()) / (7 * 86400000)));
  const funding = fundingFor(day, c, price);
  const bank = funding ? `, or ₹${price - funding.amount} with an ${funding.issuer} card` : "";
  return `Hi ${first(c.name)}, this is ${day.merchant.front_desk_name} from ${day.merchant.name}. ` +
    `It's been ${weeks} weeks since your last ${service.name.toLowerCase()}. ` +
    `${timeLabel(start)} today: ₹${price} if you pay now${bank}. Usually ₹${service.price}. ` +
    `Tap to call me anytime.`;
}

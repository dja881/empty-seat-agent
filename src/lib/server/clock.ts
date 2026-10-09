import "server-only";
import { db, logEvent, MERCHANT_ID, must } from "./db";
import { atMinutes, loadDay, parseHHMM, sellableTimes, timeLabel, type CustomerRow, type Day } from "./day";
import { createOffer, openerText, postMessage, refreshOffered } from "./offers";
import { openingPrice } from "./pricing";
import { benchmarks, customersAndOffered } from "./waves";
import { rankCustomers } from "./plan";
import { settle } from "./settle";
import { istMinutes } from "../time";

/**
 * Move the demo clock forward and let time-based things happen:
 *   offers for slots that have started expire;
 *   at 1:30 pm the agent checks live footfall and may release a held slot;
 *   in demo mode, simulated customers pay during the afternoon fast-forward.
 */
export type SimKind = "sale" | "walk_in" | "call_me";

export async function advanceClock(to: string, opts: { simulate?: SimKind[] } = {}) {
  const before = await loadDay();
  const target = parseHHMM(to);
  if (target < before.now) {
    // Going back in time is only allowed through Reset.
    return { clock: timeLabel(before.now), notes: ["clock can only move forward; use Reset demo"] };
  }
  must(await db.from("demo_state").update({ clock_at: atMinutes(before.demo.demo_date, target), updated_at: new Date().toISOString() })
    .eq("merchant_id", MERCHANT_ID), "clock");

  const day = await loadDay();
  const notes: string[] = [];

  // Slots that have started can't be sold any more.
  must(await db.from("offers").update({ status: "expired" }).in("status", ["sent", "link_sent"])
    .lt("start_at", day.demo.clock_at), "expire offers");

  if (target >= 13 * 60 + 30 && !(await hasEvent("footfall_alert"))) {
    const note = await footfallCheck(day);
    if (note) notes.push(note);
  }
  if (opts.simulate?.length && day.demo.mode === "demo") {
    for (const kind of opts.simulate) {
      const d = await loadDay();
      const note = kind === "sale" ? await simulateSale(d) : kind === "walk_in" ? await walkIn(d) : await callMe(d);
      if (note) notes.push(note);
    }
  }
  await refreshOffered();
  return { clock: timeLabel(target), notes };
}

async function hasEvent(type: string) {
  const { count } = await db.from("events").select("id", { count: "exact", head: true }).eq("merchant_id", MERCHANT_ID).eq("type", type);
  return (count ?? 0) > 0;
}

/**
 * Mid-day check: if in-store payments around the salon in the last hour are well below
 * normal, walk-ins won't fill the held time, so release the next held slot to wave 2.
 */
async function footfallCheck(day: Day) {
  const hour = Math.floor(day.now / 60);
  const rows = must(await db.rpc("footfall_vs_normal", { p_area: day.merchant.area_id, p_date: day.demo.demo_date, p_upto_hour: hour }), "footfall") as
    { scope: string; ratio: number | null }[];
  const lastHour = Number(rows.find((r) => r.scope === "last_hour")?.ratio ?? 1);
  if (lastHour >= 0.8) return null;

  // Release the held hour nearest 5 pm (late afternoon is where walk-ins were expected).
  const candidates = day.slots
    .filter((s) => s.state === "held" && istMinutes(s.end_at) - Math.max(istMinutes(s.start_at), day.now + 60) >= 45)
    .map((s) => {
      const a = istMinutes(s.start_at), b = istMinutes(s.end_at);
      const start = Math.min(Math.max(17 * 60, Math.ceil(Math.max(a, day.now + 60) / 30) * 30), b - 45);
      return { s, start, end: Math.min(b, start + 60) };
    })
    .sort((x, y) => Math.abs(x.start - 17 * 60) - Math.abs(y.start - 17 * 60) || y.s.chair - x.s.chair);
  const pick = candidates[0];
  if (!pick) return null;
  const date = day.demo.demo_date;
  const a = istMinutes(pick.s.start_at), b = istMinutes(pick.s.end_at);
  const pieces = [{ merchant_id: MERCHANT_ID, chair: pick.s.chair, start_at: atMinutes(date, pick.start), end_at: atMinutes(date, pick.end), state: "released" }];
  if (pick.start - a >= 20) pieces.push({ merchant_id: MERCHANT_ID, chair: pick.s.chair, start_at: pick.s.start_at, end_at: atMinutes(date, pick.start), state: "held" });
  if (b - pick.end >= 20) pieces.push({ merchant_id: MERCHANT_ID, chair: pick.s.chair, start_at: atMinutes(date, pick.end), end_at: pick.s.end_at, state: "held" });
  must(await db.from("slots").delete().eq("id", pick.s.id), "carve held");
  must(await db.from("slots").insert(pieces), "release held hour");
  const held = { chair: pick.s.chair, start_at: atMinutes(date, pick.start) };

  const pct = Math.round((1 - lastHour) * 100 / 5) * 5;
  const when = timeLabel(istMinutes(held.start_at));
  const text = `Foot traffic near you is ${pct}% below normal. Releasing the ${when} slot I was holding.`;
  await logEvent("footfall_alert", { text, chair: held.chair, start: when, ratio: lastHour, pct });

  // Wave 2 for the released slot: the best-ranked customer not yet offered today.
  const fresh = await loadDay();
  const target = await nextCustomer(fresh);
  if (target) await offerTo(fresh, target, istMinutes(held.start_at), held.chair, 2);
  return text;
}

/** Best-ranked eligible customer not yet offered today whose usual service fits a 45-minute slot. */
async function nextCustomer(day: Day) {
  const { customers, offered } = await customersAndOffered(day);
  return rankCustomers(day, customers, offered)
    .find((r) => !r.excluded && r.customer.usual_service_id === "svc_haircut")?.customer ?? null;
}

async function offerTo(day: Day, c: CustomerRow, start: number, chair: number, wave: number) {
  const service = day.services.find((s) => s.id === c.usual_service_id)!;
  const bench = await benchmarks();
  const price = openingPrice(day, service, bench(service.name)?.median_discount_that_filled ?? 50);
  const { offer } = await createOffer(day, { customer: c, service, chair, start, end: start + service.duration_min, price, wave });
  await postMessage(day, c.id, "salon", openerText(day, c, service, start, price), {
    template: "slot_offer_v2", links: [{ offer_id: offer.id, label: `Pay ₹${price}` }], call_button: true,
  });
  return offer;
}

/* ---------------- simulator (demo mode only) ---------------- */

// Simulated customers who buy during the 2 to 6 pm fast-forward, in order. Chosen so the
// demo day lands on the PRD's base case: 7 slots, about ₹3,100, ₹150 funded by HDFC.
const SIM_BUYERS = ["c_sneha_k", "c_aditya", "c_divya", "c_imran", "c_pooja", "c_vikram", "c_karthik"];
const DAY_TARGET = 7;

async function simulateSale(day: Day) {
  const paid = must(await db.from("offers").select("id, customer_id, funded_amount").eq("status", "paid"), "paid") as
    { id: string; customer_id: string; funded_amount: number }[];
  if (paid.length >= DAY_TARGET) return null;
  const paidBy = new Set(paid.map((p) => p.customer_id));
  const fundedSoFar = paid.reduce((n, p) => n + p.funded_amount, 0);

  must(await db.from("demo_state").update({ sim_step: day.demo.sim_step + 1 }).eq("merchant_id", MERCHANT_ID), "sim step");

  // The released-at-1:30 slot's wave 2 customer buys first if they're still open.
  const open = must(await db.from("offers").select("*, customers(*)").in("status", ["sent", "link_sent"])
    .gt("start_at", atMinutes(day.demo.demo_date, day.now + 15)).order("wave", { ascending: false }), "open offers") as
    { id: string; customer_id: string; wave: number; funded_amount: number; customers: CustomerRow }[];
  const wave2 = open.find((o) => o.wave === 2 && !paidBy.has(o.customer_id) && o.customer_id !== "c_riya");

  let offerId: string | null = wave2?.id ?? null;
  let customer: CustomerRow | null = wave2?.customers ?? null;
  if (!offerId) {
    for (const id of SIM_BUYERS) {
      if (paidBy.has(id)) continue;
      const existing = open.find((o) => o.customer_id === id);
      if (existing) { offerId = existing.id; customer = existing.customers; break; }
      const c = must(await db.from("customers").select("*").eq("id", id).single(), "customer") as CustomerRow;
      const service = day.services.find((s) => s.id === c.usual_service_id)!;
      const t = sellableTimes(day, service.duration_min, { step: 30 }).find((x) => x.start >= day.now + 30);
      if (!t) continue;
      const o = await offerTo(day, c, t.start, t.chairs[0], 2);
      offerId = o.id; customer = c;
      break;
    }
  }
  if (!offerId || !customer) return null;
  const useBank = customer.card_issuer === "HDFC" && fundedSoFar < 150;
  const { result, offer } = await settle(offerId, { orderId: null, paymentId: null, simulated: true, ...(await amounts(offerId, useBank)) });
  return result === "paid" ? `${offer.guest_name ?? offer.customers?.name} paid` : null;
}

async function amounts(offerId: string, bank: boolean) {
  const o = must(await db.from("offers").select("price, funded_amount").eq("id", offerId).single(), "offer") as { price: number; funded_amount: number };
  const funded = bank ? o.funded_amount : 0;
  return { amount: o.price - funded, funded };
}

/** A customer whose offered time was sold to someone else asks the front desk to call. */
async function callMe(day: Day) {
  if (await hasEvent("call_me")) return null;
  const offers = must(await db.from("offers").select("customer_id, status, start_at, customers(name)").not("customer_id", "is", null), "offers") as
    unknown as { customer_id: string; status: string; start_at: string; customers: { name: string } }[];
  const paid = new Set(offers.filter((o) => o.status === "paid").map((o) => o.customer_id));
  const lost = offers.find((o) => o.status === "cancelled" && !paid.has(o.customer_id) && o.customer_id !== "c_riya");
  if (!lost) return null;
  const customerId = lost.customer_id;
  const c = { name: lost.customers.name };
  await postMessage(day, customerId, "customer", `Can someone call me? I wanted ${timeLabel(istMinutes(lost.start_at))} but the link says it's taken.`);
  await logEvent("call_me", { customer: c.name, customer_id: customerId, reason: "Asked for a call about 4 pm" });
  return `${c.name} asked for a call`;
}

/** A walk-in arrives and takes held time: proof the hold was worth keeping. */
async function walkIn(day: Day) {
  const held = day.slots
    .filter((s) => s.state === "held" && istMinutes(s.end_at) - Math.max(istMinutes(s.start_at), day.now) >= 45)
    .sort((a, b) => istMinutes(a.start_at) - istMinutes(b.start_at))[0];
  if (!held) return null;
  const start = Math.ceil(Math.max(istMinutes(held.start_at), day.now) / 15) * 15;
  const a = istMinutes(held.start_at), b = istMinutes(held.end_at);
  if (start + 45 > b) return null;
  const date = day.demo.demo_date;
  const rest = [];
  if (start - a >= 20) rest.push({ merchant_id: MERCHANT_ID, chair: held.chair, start_at: held.start_at, end_at: atMinutes(date, start), state: "held" });
  if (b - (start + 45) >= 20) rest.push({ merchant_id: MERCHANT_ID, chair: held.chair, start_at: atMinutes(date, start + 45), end_at: held.end_at, state: "held" });
  must(await db.from("slots").delete().eq("id", held.id), "carve held");
  if (rest.length) must(await db.from("slots").insert(rest), "rest of held");
  must(await db.from("bookings").insert({ merchant_id: MERCHANT_ID, service_id: "svc_haircut", chair: held.chair,
    start_at: atMinutes(date, start), end_at: atMinutes(date, start + 45), price: 450, source: "walk_in" }), "walk-in");
  await logEvent("walk_in", { chair: held.chair, start: timeLabel(start) });
  return `walk-in at ${timeLabel(start)} on chair ${held.chair}`;
}

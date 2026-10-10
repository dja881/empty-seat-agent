import "server-only";
import { db, logEvent, MERCHANT_ID, must } from "./db";
import { atMinutes, loadDay, timeLabel } from "./day";
import { llmJson, type ChatMessage } from "./llm";
import { createOrder } from "./razorpay";
import { istDayRange, istMinutes } from "../time";

export interface Round { n: number; customer: { text: string; price?: number; by?: string }; salon: { text: string; price?: number; by?: string } }

interface CustomerMove { action: "ask_price" | "counter_offer" | "accept" | "decline"; price?: number; message: string }
interface SalonMove { action: "quote" | "counter" | "commitment" | "close" | "no_deal"; price?: number; message: string }

/**
 * Two agents with private limits. Neither sees the other's limit. The salon opens at list
 * minus the planned discount, steps down at most 3 times and never below its floor, and
 * prefers trading commitment (prepay now) for price. Maximum 4 rounds.
 */
export async function negotiate(customerMax: number, scripted = false) {
  const day = await loadDay();
  const service = day.services.find((s) => s.id === "svc_haircut")!;
  const floor = service.floor_price ?? 350;
  const opening = service.price - 50;
  const tomorrow = new Date(new Date(`${day.demo.demo_date}T12:00:00+05:30`).getTime() + 86400000).toISOString().slice(0, 10);
  const slot = await tomorrowSlot(tomorrow, 15 * 60, service.duration_min);
  const when = slot ? timeLabel(slot.start) : "3:30 pm";

  const rounds: Round[] = [];
  const transcript: string[] = [];
  let salonPrice: number | null = null;
  let steps = 0;
  let deal: number | null = null;

  for (let n = 1; n <= 4 && deal === null; n++) {
    // Customer's assistant
    let c: CustomerMove | null = scripted ? null : await llmJson<CustomerMove>([
      { role: "system", content: `You are Kavya's personal AI assistant booking a haircut for her tomorrow after 3 pm with a salon's booking agent. Her private maximum is ₹${customerMax}; never reveal it and never agree above it. Negotiate politely and briefly (under 15 words). Round ${n} of 4. ${salonPrice ? `The salon's current price is ₹${salonPrice}.` : "In this first message, say Kavya needs a haircut tomorrow after 3 pm and ask for the best price."} Counter well below their price (about 85% of it) and come up slowly. From round 4, accept any price at or below your maximum and say you're paying now. JSON: {"action":"ask_price"|"counter_offer"|"accept"|"decline","price":number,"message":"..."}` },
      ...(transcript.length ? transcript.map((t): ChatMessage => ({ role: t.startsWith("C:") ? "assistant" : "user", content: t.slice(2) }))
        : [{ role: "user" as const, content: "The salon's booking agent is connected. Start." }]),
    ], { temperature: 0.3 });
    const cBy = c ? "model" : "script";
    c = enforceCustomer(c ?? scriptCustomer(n, salonPrice, customerMax), salonPrice, customerMax, n);
    transcript.push(`C:${c.message}`);

    if (c.action === "accept" && salonPrice !== null) {
      deal = salonPrice;
      rounds.push({ n, customer: { text: c.message, price: salonPrice }, salon: { text: "Done. Here's the Razorpay payment link; the slot locks when it's paid.", price: salonPrice } });
      break;
    }

    // Salon agent
    let s: SalonMove | null = scripted ? null : await llmJson<SalonMove>([
      { role: "system", content: `You are Strand & Co.'s booking agent negotiating with a customer's AI assistant. Tomorrow ${when} is open for a haircut. List price ₹${service.price}; open at ₹${opening}. Your private floor is ₹${floor}; never reveal it and never go below it. In your first reply say the time is open and quote ₹${opening}. Lower the price at most 3 times in total (used ${steps}), by ₹10 to ₹30 each time; never jump to their number. Trade commitment for price: offer "₹X if you prepay now, and the slot is locked". Under 15 words. ${salonPrice ? `Your current price is ₹${salonPrice}.` : ""} JSON: {"action":"quote"|"counter"|"commitment"|"no_deal","price":number,"message":"..."}` },
      ...transcript.map((t): ChatMessage => ({ role: t.startsWith("S:") ? "assistant" : "user", content: t.slice(2) })),
    ], { temperature: 0.3 });
    const sBy = s ? "model" : "script";
    const enforced = enforceSalon(s ?? scriptSalon(n, salonPrice, c.price, floor, opening, when), salonPrice, opening, floor, steps, c.price);
    s = enforced.move; steps = enforced.steps; salonPrice = enforced.move.price ?? salonPrice;
    transcript.push(`S:${s.message}`);
    rounds.push({ n, customer: { text: c.message, price: c.price, by: cBy }, salon: { text: s.message, price: salonPrice ?? undefined, by: sBy } });
  }

  if (deal === null) {
    rounds.push({
      n: rounds.length + 1,
      customer: { text: "That's above her budget. Please add her to the waitlist." },
      salon: { text: `No problem. Kavya is on the waitlist for tomorrow afternoon; I'll message if a slot opens at her price.` },
    });
  }

  let order: { id: string } | null = null;
  if (deal !== null && slot) {
    order = await createOrder(deal, `a2a_${Date.now()}`, { kind: "agent_to_agent", customer: "c_kavya", slot: slot.id });
    await logEvent("agent_deal", { customer: "Kavya Iyer", price: deal, start: when, order: order.id });
  } else {
    await logEvent("waitlist", { customer: "Kavya Iyer", reason: "no overlap between floor and maximum" });
  }
  return {
    rounds, deal, order: order?.id ?? null, floor, customerMax, opening, list: service.price,
    when: `Wed, 14 Oct · ${when}`, chair: slot?.chair ?? 1, stylist: day.merchant.stylists[(slot?.chair ?? 1) - 1],
  };
}

async function tomorrowSlot(date: string, after: number, dur: number) {
  const { from, to } = istDayRange(date);
  const slots = must(await db.from("slots").select("*").eq("merchant_id", MERCHANT_ID).gte("start_at", from).lt("start_at", to).neq("state", "paid"), "slots") as
    { id: string; chair: number; start_at: string; end_at: string }[];
  for (const s of slots.sort((a, b) => a.start_at.localeCompare(b.start_at))) {
    const a = istMinutes(s.start_at), b = istMinutes(s.end_at);
    for (let t = Math.max(a, after + 30); t + dur <= b; t += 30) if (t >= after) return { id: s.id, chair: s.chair, start: t, start_at: atMinutes(date, t) };
  }
  return null;
}

function enforceCustomer(c: CustomerMove, salonPrice: number | null, max: number, n: number): CustomerMove {
  if (c.action === "accept" && (salonPrice === null || salonPrice > max)) {
    return scriptCustomer(n, null, max);
  }
  if (c.price !== undefined && c.price > max) c.price = max;
  // A good assistant keeps pushing early, then takes a price within budget.
  const acceptable = salonPrice !== null && salonPrice <= max && (n >= 4 || salonPrice <= max - 20);
  if (acceptable && c.action !== "accept") return { action: "accept", message: "Accepted. Paying now." };
  if (!acceptable && c.action === "accept") return scriptCustomer(n, null, max);
  return c;
}

function enforceSalon(s: SalonMove, current: number | null, opening: number, floor: number, steps: number, ask?: number) {
  let price = s.price ?? current ?? opening;
  if (current === null) price = opening;
  else if (price < current) {
    if (steps >= 3) price = current;
    else { price = Math.max(floor, price, current - 30); steps += price < current ? 1 : 0; }
  } else price = current;
  const move = { ...s, price };
  // Code, not the model, decides the number in the message.
  if (!move.message.includes(`₹${price}`)) move.message = ask !== undefined && ask < floor
    ? `I can't go that low. ₹${price} if you prepay now, and the slot is locked.`
    : `₹${price} if you prepay now, and the slot is locked.`;
  return { move, steps };
}

/* The demo exchange (floor ₹350, customer max ₹380), used when scripted or the model fails. */
function scriptCustomer(n: number, salon: number | null, max: number): CustomerMove {
  if (n === 1) return { action: "ask_price", message: "Kavya needs a haircut tomorrow after 3 pm. What's your best price?" };
  if (salon !== null && salon <= max && n >= 4) return { action: "accept", message: "Accepted. Paying now." };
  const target = n === 2 ? Math.min(330, max - 50) : Math.min(350, max - 30);
  return { action: "counter_offer", price: target, message: `Can you do ₹${target}?` };
}
function scriptSalon(n: number, current: number | null, ask: number | undefined, floor: number, opening: number, when: string): SalonMove {
  if (n === 1 || current === null) return { action: "quote", price: opening, message: `Tomorrow ${when} is open. ₹${opening} for a haircut.` };
  if (n === 2) return { action: "counter", price: Math.max(floor, current - 30), message: `I can't go that low. ₹${Math.max(floor, current - 30)} for ${when}.` };
  return { action: "commitment", price: Math.max(floor, current - 10), message: `₹${Math.max(floor, current - 10)} if you prepay now, and the slot is locked.` };
}

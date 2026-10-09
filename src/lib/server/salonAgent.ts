import "server-only";
import crypto from "node:crypto";
import { db, logEvent, must } from "./db";
import { loadDay, parseHHMM, sellableTimes, timeLabel, type CustomerRow, type Day, type ServiceRow } from "./day";
import { llmJson, type ChatMessage } from "./llm";
import { anyFunding, enforcePrice, limitsFor } from "./pricing";
import { cancelOpenOffers, createOffer, postMessage, refreshOffered, type LinkButton } from "./offers";
import { istMinutes } from "../time";

const ACTIONS = [
  "send_offer", "offer_other_time", "fit_service_to_gap", "add_friend", "step_down_price",
  "send_payment_link", "add_to_waitlist", "alert_front_desk", "hand_to_owner", "reply", "decline",
] as const;
type Action = (typeof ACTIONS)[number];

interface AgentOutput {
  action: Action;
  time?: string;          // "16:00"
  service_id?: string;
  party_size?: number;
  price?: number;         // per person, what the salon receives
  guest_name?: string;
  message: string;
}

interface OpenOffer {
  id: string; service_id: string; chair: number; start_at: string; end_at: string;
  price: number; funded_amount: number; price_steps: number; guest_name: string | null; group_id: string | null;
}

const OFFER_ACTIONS: Action[] = ["send_offer", "offer_other_time", "fit_service_to_gap", "add_friend", "step_down_price", "send_payment_link"];
const first = (name: string) => name.split(" ")[0];

/** A customer wrote in. Record it, let the salon agent decide, enforce limits, reply. */
export async function handleCustomerMessage(customerId: string, text: string) {
  const day = await loadDay();
  const customer = must(await db.from("customers").select("*").eq("id", customerId).single(), "customer") as CustomerRow;
  await postMessage(day, customerId, "customer", text);
  await logEvent("reply", { customer: customer.name, text });

  if (/^\s*stop\s*$/i.test(text)) {
    await db.from("customers").update({ opted_out: true }).eq("id", customerId);
    await cancelOpenOffers(customerId);
    await refreshOffered();
    return postMessage(day, customerId, "salon", "You won't get offers from Glow Salon again. Reply START anytime to opt back in.");
  }

  const [threadRes, offersRes] = await Promise.all([
    db.from("messages").select("sender, body").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(14),
    db.from("offers").select("*").eq("customer_id", customerId).in("status", ["sent", "link_sent"]).order("created_at"),
  ]);
  const thread = (must(threadRes, "thread") as { sender: string; body: string }[]).reverse();
  const open = must(offersRes, "offers") as OpenOffer[];

  const decided = day.demo.scripted ? null : await decide(day, customer, thread, open);
  const out = decided ?? scriptedReply(day, customer, text, open);
  if (!decided && !day.demo.scripted) console.warn("salon agent: model unavailable, used scripted reply");
  return execute(day, customer, out, open, decided ? "model" : "script");
}

/* ---------------- the LLM step ---------------- */

async function decide(day: Day, customer: CustomerRow, thread: { sender: string; body: string }[], open: OpenOffer[]) {
  const svc = (id: string) => day.services.find((s) => s.id === id)!;
  const current = open.find((o) => !o.guest_name) ?? open[0];
  const usual = svc(current?.service_id ?? customer.usual_service_id);

  const menu = day.services.map((s) => {
    const l = limitsFor(day, s);
    const times = sellableTimes(day, s.duration_min).filter((t) => t.start % 30 === 0).slice(0, 12)
      .map((t) => `${hhmm(t.start)}(${t.chairs.length})`).join(" ");
    return `- ${s.id} "${s.name}" ${s.duration_min} min, list ₹${s.price}, ` +
      (l.discountable ? `lowest you may go ₹${l.minNet}` : "never discounted") +
      `. Open times today (chairs free): ${times || "none"}`;
  }).join("\n");

  const funding = anyFunding(day, current?.price ?? usual.price);
  const offerLine = current
    ? `Current offer: ${svc(current.service_id).name} at ${timeLabel(istMinutes(current.start_at))}, ₹${current.price}` +
      (funding ? ` (₹${current.price - funding.amount} with an ${funding.issuer} card, bank pays ₹${funding.amount})` : "") +
      `, price steps used ${current.price_steps} of 3, seats ${open.length}.`
    : "No open offer.";

  const system: ChatMessage = {
    role: "system",
    content: `You are ${day.merchant.front_desk_name}, the receptionist at ${day.merchant.name}, a salon in Madhapur, Hyderabad, chatting on WhatsApp with a regular customer. You sell today's open chair time.

Write like a real Indian receptionist on WhatsApp: short (1 to 3 sentences, under 45 words), warm, plain words, no emojis, no exclamation overload, no sign-off. Use ₹ and times like "4 pm".

Customer: ${customer.name}. Usual service: ${svc(customer.usual_service_id).name}. Card: ${customer.card_issuer ?? "unknown"}.
${offerLine}
Today is ${timeLabel(day.now)} now.
Services and limits:
${menu}

Rules:
- Only offer times listed above, and a party only if that many chairs are free then.
- Never go below "lowest you may go". Lower the price at most one step (₹10 to ₹30) per reply and at most 3 times in total. Prefer asking for a commitment instead of a discount: pay now to lock the slot, a different time, or bring a friend (each pays their own share).
- A bank offer gives ₹${funding?.amount ?? 50} off on ${funding?.issuer ?? "HDFC"} cards at checkout; mention it when relevant.
- Payment links are attached automatically to any offer you make; say "here's the link" or "here are both links".
- If they ask for something you can't do, want to talk, or complain, use alert_front_desk and say you'll call them.
- If the time they want is taken, offer the nearest open time or add_to_waitlist.

Reply with JSON only:
{"action": one of ${JSON.stringify(ACTIONS)},
 "time": "HH:MM" (24h, for offers), "service_id": "...", "party_size": 1 or 2, "price": per-person price the salon receives,
 "guest_name": "friend's name if given", "message": "your WhatsApp reply"}`,
  };
  const history: ChatMessage[] = thread.map((m) => ({
    role: m.sender === "customer" ? "user" : "assistant",
    content: m.body,
  }));
  return llmJson<AgentOutput>([system, ...history]);
}

/* ---------------- enforcement and side effects ---------------- */

async function execute(day: Day, customer: CustomerRow, out: AgentOutput, open: OpenOffer[], by: "model" | "script") {
  const action: Action = ACTIONS.includes(out.action) ? out.action : "hand_to_owner";

  if (action === "add_to_waitlist") {
    await logEvent("waitlist", { customer: customer.name, time: out.time });
    return postMessage(day, customer.id, "salon", out.message || "I've added you to the waitlist. I'll message you if a chair opens up.", { by });
  }
  if (action === "alert_front_desk" || action === "hand_to_owner") {
    await logEvent("call_me", { customer: customer.name, customer_id: customer.id, reason: out.message });
    return postMessage(day, customer.id, "salon", out.message || `I'll call you in a few minutes. ${day.merchant.front_desk_name}`, { call_me: true, by });
  }
  if (action === "decline") {
    await cancelOpenOffers(customer.id);
    await refreshOffered();
    return postMessage(day, customer.id, "salon", out.message || "No problem. See you next time.", { by });
  }
  if (!OFFER_ACTIONS.includes(action)) {
    return postMessage(day, customer.id, "salon", out.message || "Let me check and get back to you.", { by });
  }

  // An offer: resolve service, time, party and price, then hold them to the limits.
  const current = open.find((o) => !o.guest_name) ?? open[0];
  const service = day.services.find((s) => s.id === out.service_id)
    ?? day.services.find((s) => s.id === current?.service_id)
    ?? day.services.find((s) => s.id === customer.usual_service_id)!;
  const party = Math.min(2, Math.max(1, out.party_size ?? (action === "add_friend" ? 2 : open.length || 1)));
  const wanted = out.time ? parseHHMM(out.time) : current ? istMinutes(current.start_at) : day.now + 90;

  const times = sellableTimes(day, service.duration_min).filter((t) => t.chairs.length >= party);
  if (!times.length) {
    await logEvent("waitlist", { customer: customer.name, reason: "no open time" });
    return postMessage(day, customer.id, "salon", "Sorry, we're full for that today. I've added you to the waitlist and I'll message you if a chair opens up.");
  }
  const slot = times.reduce((best, t) => (Math.abs(t.start - wanted) < Math.abs(best.start - wanted) ? t : best));

  const currentPrice = current?.price ?? service.price;
  let proposed = out.price ?? currentPrice;
  let steps = current?.price_steps ?? 0;
  if (proposed < currentPrice) {
    if (steps >= 3) proposed = currentPrice;
    else { steps += 1; proposed = Math.max(proposed, currentPrice - 30); }
  }
  const { price, adjusted } = enforcePrice(day, service, proposed);

  const timeMoved = slot.start !== wanted;
  const partyChanged = out.party_size !== undefined && out.party_size !== party;
  let message = out.message;
  if (adjusted || timeMoved || partyChanged || !message) {
    message = await rewrite(day, customer, { service, start: slot.start, price, party, original: out.message });
  }

  // Supersede earlier offers, then one offer per seat, each paid separately.
  await cancelOpenOffers(customer.id);
  const groupId = party > 1 ? crypto.randomUUID() : null;
  const guest = party > 1 ? (out.guest_name?.trim() || `${first(customer.name)}'s guest`) : null;
  const links: LinkButton[] = [];
  const freshDay = day; // chairs are picked from the same snapshot used to validate
  for (let seat = 0; seat < party; seat++) {
    const { offer } = await createOffer(freshDay, {
      customer, service, chair: slot.chairs[seat], start: slot.start, end: slot.start + service.duration_min,
      price, wave: current ? 2 : 1, guestName: seat === 0 ? null : guest, groupId, steps,
    });
    links.push({ offer_id: offer.id, label: party > 1 ? `${seat === 0 ? first(customer.name) : guest} · Pay ₹${price}` : `Pay ₹${price}` });
  }
  await db.from("offers").update({ status: "link_sent" }).in("id", links.map((l) => l.offer_id));
  await refreshOffered();
  await logEvent("offer_sent", { customer: customer.name, time: timeLabel(slot.start), price, party, adjusted });
  return postMessage(day, customer.id, "salon", message, { links, by });
}

/** Second pass when code changed what the agent proposed: say exactly what will be sent. */
async function rewrite(day: Day, customer: CustomerRow, f: { service: ServiceRow; start: number; price: number; party: number; original?: string }) {
  const funding = anyFunding(day, f.price);
  const facts = `${f.party > 1 ? `${f.party} people, ` : ""}${f.service.name} at ${timeLabel(f.start)} today, ₹${f.price}${f.party > 1 ? " each" : ""}` +
    (funding ? `, or ₹${f.price - funding.amount} with an ${funding.issuer} card` : "");
  const res = await llmJson<{ message: string }>([
    { role: "system", content: `You are ${day.merchant.front_desk_name} at ${day.merchant.name} on WhatsApp. Rewrite the draft so it states exactly these facts and nothing else about price or time: ${facts}. Mention the payment link${f.party > 1 ? "s" : ""}. 1 to 2 short sentences, no emojis. JSON: {"message": "..."}` },
    { role: "user", content: f.original || "(no draft)" },
  ], { temperature: 0.2 });
  return res?.message || `${facts}. Here ${f.party > 1 ? "are both links" : "is the link"} to pay and lock it.`;
}

/* ---------------- scripted switch ---------------- */

/** Deterministic replies for the demo script, used when scripted mode is on or the model fails. */
function scriptedReply(day: Day, customer: CustomerRow, text: string, open: OpenOffer[]): AgentOutput {
  const t = text.toLowerCase();
  const current = open.find((o) => !o.guest_name) ?? open[0];
  const price = current?.price ?? 380;
  const funding = anyFunding(day, price);
  const bank = funding ? `, or ₹${price - funding.amount} with an ${funding.issuer} card` : "";
  const friend = /sister|brother|friend|wife|husband|two of us|2 of us/.test(t);
  const timeMatch = t.match(/\b(1[0-2]|[1-9])(?::(\d\d))?\s*(am|pm)?\b/);
  if (timeMatch || friend) {
    const h = timeMatch ? Number(timeMatch[1]) : current ? Math.floor(istMinutes(current.start_at) / 60) % 12 : 4;
    const hour24 = h < 9 ? h + 12 : h;
    const time = `${String(hour24).padStart(2, "0")}:${timeMatch?.[2] ?? "00"}`;
    return {
      action: friend ? "add_friend" : "offer_other_time", time, party_size: friend ? 2 : 1, price,
      service_id: current?.service_id ?? customer.usual_service_id,
      message: friend
        ? `Yes, ${timeLabel(parseHHMM(time))} for two. ₹${price} each${bank}. Here are both links.`
        : `Yes, ${timeLabel(parseHHMM(time))} works. ₹${price}${bank}. Here's the link.`,
    };
  }
  if (/call|talk|speak/.test(t)) return { action: "alert_front_desk", message: `Sure, I'll call you in a few minutes. ${day.merchant.front_desk_name}` };
  if (/no|not today|busy|later/.test(t)) return { action: "decline", message: "No problem. I'll keep you posted on open slots." };
  if (/cheap|less|discount|lower|best price/.test(t) && current) {
    return { action: "step_down_price", price: price - 20, message: `I can do ₹${price - 20} if you pay now to lock it.` };
  }
  return { action: "hand_to_owner", message: `Let me check with the team and call you back in a few minutes. ${day.merchant.front_desk_name}` };
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

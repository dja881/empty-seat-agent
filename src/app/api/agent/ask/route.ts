import { NextResponse } from "next/server";
import { db, logEvent, MERCHANT_ID, must } from "@/lib/server/db";
import { loadDay, parseHHMM, timeLabel } from "@/lib/server/day";
import { llmJson } from "@/lib/server/llm";
import { refreshOffered } from "@/lib/server/offers";
import { savePlan } from "@/lib/server/plan";
import { istMinutes } from "@/lib/time";

interface Intent {
  intent: "status" | "pause" | "resume" | "keep_open" | "set_discount" | "other";
  time?: string;     // "17:00"
  amount?: number;   // new max discount
  reply?: string;
}

/**
 * The owner talks to the agent during the day, by voice or typing:
 * "how are we doing?", "pause offers", "keep 5 pm open", "make it ₹80".
 * The model only classifies; numbers and changes come from code.
 */
export async function POST(req: Request) {
  const { text } = await req.json();
  const day = await loadDay();
  const plan = day.demo.plan;
  const said = String(text ?? "").slice(0, 300);

  const res = await llmJson<Intent>([
    { role: "system", content: `Classify a salon owner's message to her booking agent. JSON only: {"intent": "status"|"pause"|"resume"|"keep_open"|"set_discount"|"other", "time": "HH:MM" (24h, for keep_open), "amount": number (new maximum discount in rupees, for set_discount), "reply": "for intent other: a short, warm spoken answer under 20 words"}.
Examples: "how are we doing?" -> status. "stop sending offers" -> pause. "keep 5 pm free for walk-ins" -> keep_open 17:00. "only ₹80 off from now" -> set_discount 80.` },
    { role: "user", content: said },
  ], { temperature: 0 });
  const intent: Intent = res ?? fallback(said);

  let reply = "";
  if (intent.intent === "status") {
    const [paid, open, walkIns] = await Promise.all([
      db.from("offers").select("merchant_net, funded_amount").eq("status", "paid"),
      db.from("offers").select("id", { count: "exact", head: true }).in("status", ["sent", "link_sent"]),
      db.from("events").select("id", { count: "exact", head: true }).eq("merchant_id", MERCHANT_ID).eq("type", "walk_in"),
    ]);
    const rows = must(paid, "paid") as { merchant_net: number; funded_amount: number }[];
    const total = rows.reduce((n, r) => n + r.merchant_net, 0);
    reply = rows.length
      ? `${rows.length} slot${rows.length > 1 ? "s" : ""} sold so far, ₹${total.toLocaleString("en-IN")} recovered. ${open.count ?? 0} offers are still open${walkIns.count ? ` and ${walkIns.count} walk-ins came in` : ""}.`
      : `Nothing sold yet. ${open.count ?? 0} offers are out; most people reply within the hour.`;
  } else if ((intent.intent === "pause" || intent.intent === "resume") && plan) {
    plan.status = intent.intent === "pause" ? "paused" : "approved";
    await savePlan(plan);
    reply = intent.intent === "pause" ? "Paused. No new offers will go out until you say so." : "Back on. I'll keep offering the open time.";
  } else if (intent.intent === "keep_open" && intent.time) {
    const m = parseHHMM(intent.time);
    const hits = day.slots.filter((s) => ["released", "offered"].includes(s.state) && istMinutes(s.start_at) <= m && istMinutes(s.end_at) > m);
    if (hits.length) {
      must(await db.from("slots").update({ state: "held" }).in("id", hits.map((h) => h.id)), "hold");
      must(await db.from("offers").update({ status: "cancelled" }).in("status", ["sent", "link_sent"])
        .lte("start_at", new Date(`${day.demo.demo_date}T${intent.time}:00+05:30`).toISOString())
        .gt("end_at", new Date(`${day.demo.demo_date}T${intent.time}:00+05:30`).toISOString()), "cancel offers");
      await refreshOffered();
    }
    reply = hits.length ? `Done. ${timeLabel(m)} is kept for walk-ins and I've withdrawn those offers.` : `${timeLabel(m)} is already kept for walk-ins.`;
  } else if (intent.intent === "set_discount" && intent.amount !== undefined && plan) {
    plan.maxDiscount = Math.max(0, Math.min(day.merchant.max_discount, Math.round(intent.amount / 10) * 10));
    await savePlan(plan);
    reply = `Done. New offers go out at up to ₹${plan.maxDiscount} off.`;
  } else {
    reply = intent.reply || "I can tell you how the day is going, pause offers, keep a time for walk-ins, or change the discount.";
  }
  await logEvent("owner_asked", { text: said, intent: intent.intent });
  return NextResponse.json({ reply });
}

function fallback(t: string): Intent {
  const s = t.toLowerCase();
  if (/how|status|doing|sold|update/.test(s)) return { intent: "status" };
  if (/pause|stop/.test(s)) return { intent: "pause" };
  if (/resume|start again|continue/.test(s)) return { intent: "resume" };
  const keep = s.match(/keep\s+(\d{1,2})/);
  if (keep) { const h = Number(keep[1]); return { intent: "keep_open", time: `${h < 9 ? h + 12 : h}:00` }; }
  const amt = s.match(/(\d{2,3})/);
  if (amt) return { intent: "set_discount", amount: Number(amt[1]) };
  return { intent: "other" };
}

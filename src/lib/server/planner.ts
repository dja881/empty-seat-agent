import "server-only";
import { logEvent } from "./db";
import { timeLabel, type Day, type Plan } from "./day";
import { llmJson } from "./llm";
import type { Signals } from "./plan";

const WEEKDAY = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });

/** The spoken morning briefing, built from the plan's numbers. */
export function briefingText(day: Day, plan: Plan) {
  const foot = plan.footfallPct < 0
    ? `Foot traffic near you is ${Math.abs(plan.footfallPct)}% below a normal ${WEEKDAY(day.demo.demo_date)}`
    : `Foot traffic near you is about normal for a ${WEEKDAY(day.demo.demo_date)}`;
  const salons = plan.salonsPct <= -10 ? " and nearby salons are quiet too" : "";
  return `Good morning ${day.merchant.owner_name}. You have ${plan.openUnits} open slots today, most between 1 and 5 pm. ` +
    `${foot}${salons}. I expect walk-ins to take about ${plan.heldUnits}, so I'll offer the other ${plan.releasedUnits} at up to ₹${plan.maxDiscount} off.`;
}

interface PlanEdit {
  max_discount?: number;
  keep_open?: string[];          // "16:00"
  exclude_services?: string[];   // service ids
  approve?: boolean;
  skip?: boolean;
  reply: string;
}

/**
 * The owner spoke or typed a change. The LLM turns words into plan changes; code checks
 * them against the owner's settings (it cannot raise the discount above the settings cap
 * or discount a never-discount service).
 */
export async function interpretEdit(day: Day, plan: Plan, text: string, signals: Signals) {
  void signals;
  const services = day.services.map((s) => `${s.id} = ${s.name}`).join(", ");
  const res = await llmJson<PlanEdit>([
    {
      role: "system",
      content: `You are the Empty Seat Agent talking to ${day.merchant.owner_name}, owner of ${day.merchant.name}, by voice.
Current plan: offer ${plan.releasedUnits} open slots at up to ₹${plan.maxDiscount} off; hold ${plan.heldUnits} for walk-ins (${plan.heldHours}); first messages at ${plan.firstWaveAt}.
Settings cap on discount: ₹${day.merchant.max_discount}. Services: ${services}. Never discounted: ${day.merchant.never_discount_services.join(", ") || "none"}.
Turn the owner's words into plan changes. "go ahead", "yes", "start" mean approve. "not today" means skip.
max_discount is the NEW limit the owner wants, not the old one they are rejecting.
Example: "₹200 is too much. Make it ₹100." -> {"max_discount": 100, "reply": "Done. Up to ₹100 off. Shall I start?"}
Example: "Keep 4 pm open for walk-ins." -> {"keep_open": ["16:00"], "reply": "Done. I'll keep 4 pm for walk-ins. Shall I start?"}
Reply JSON only: {"max_discount": number?, "keep_open": ["HH:MM"]?, "exclude_services": [ids]?, "approve": bool?, "skip": bool?, "reply": "spoken reply, under 20 words, confirm the change and ask 'Shall I start?' unless approving"}`,
    },
    { role: "user", content: text },
  ], { temperature: 0.2 });

  const edit: PlanEdit = res ?? scriptedEdit(text, plan);
  // "make it ₹100" / "only ₹80 off": the owner's last amount is the new limit, whatever the model read.
  const amounts = [...text.matchAll(/(?:₹|rs\.?\s?|inr\s?)?(\d{2,4})(?!\s*(?:pm|am|:|\d))/gi)].map((m) => Number(m[1]));
  if (edit.max_discount !== undefined && amounts.length && /make it|only|max|up to|instead|reduce|lower|limit/i.test(text)) {
    edit.max_discount = amounts[amounts.length - 1];
  }
  const next: Partial<Plan> = {};
  if (edit.max_discount !== undefined) {
    next.maxDiscount = Math.max(0, Math.min(day.merchant.max_discount, Math.round(edit.max_discount / 10) * 10));
  }
  if (edit.keep_open?.length) next.keepOpen = [...new Set([...(plan.keepOpen ?? []), ...edit.keep_open])];
  if (edit.exclude_services?.length) {
    next.excludedServices = [...new Set([...(plan.excludedServices ?? []), ...edit.exclude_services.filter((id) => day.services.some((s) => s.id === id))])];
  }
  await logEvent("plan_edited", { text, change: next });
  return { edit, next };
}

function scriptedEdit(text: string, plan: Plan): PlanEdit {
  const t = text.toLowerCase();
  if (/go ahead|start|yes|approve|do it/.test(t)) return { approve: true, reply: "Starting now. First messages go out at 11:30." };
  if (/not today|skip/.test(t)) return { skip: true, reply: "Okay, I'll sit today out." };
  const rupees = t.match(/₹?\s?(\d{2,4})/);
  if (rupees) {
    const n = Number(rupees[1]);
    return { max_discount: n, reply: `Done. ${plan.releasedUnits} slots at up to ₹${n} off. Shall I start?` };
  }
  const keep = t.match(/keep\s+(\d{1,2})/);
  if (keep) {
    const h = Number(keep[1]) < 9 ? Number(keep[1]) + 12 : Number(keep[1]);
    return { keep_open: [`${h}:00`], reply: `Done. I'll keep ${timeLabel(h * 60)} for walk-ins. Shall I start?` };
  }
  return { reply: "Sorry, I didn't catch that. You can change the discount or keep a time open." };
}

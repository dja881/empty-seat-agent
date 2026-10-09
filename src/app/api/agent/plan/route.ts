import { NextResponse } from "next/server";
import { logEvent } from "@/lib/server/db";
import { loadDay, timeLabel, parseHHMM } from "@/lib/server/day";
import { applyPlan, proposePlan, readSignals, savePlan } from "@/lib/server/plan";
import { briefingText, interpretEdit } from "@/lib/server/planner";

/**
 * The morning plan.
 *   {op: "propose"}         build (or rebuild) today's plan from bookings and network signals
 *   {op: "edit", text}      the owner's spoken or typed change
 *   {op: "approve" | "skip" | "pause" | "resume"}
 */
export async function POST(req: Request) {
  const { op, text } = await req.json();
  const day = await loadDay();
  const signals = await readSignals(day);

  if (op === "propose") {
    const plan = await proposePlan(day, signals, day.demo.plan ? {} : { status: "proposed", history: [] });
    const briefing = briefingText(day, plan);
    if (!plan.history.length) plan.history = [{ from: "agent", text: briefing }];
    await savePlan(plan);
    if (!day.demo.plan) await logEvent("plan_proposed", { released: plan.releasedUnits, held: plan.heldUnits });
    return NextResponse.json({ plan, briefing, signals: summary(signals) });
  }

  let plan = await proposePlan(day, signals);
  let reply = "";
  const alreadyApproved = day.demo.plan?.status === "approved";

  if (op === "edit") {
    const { edit, next } = await interpretEdit(day, plan, String(text ?? ""), signals);
    plan = await proposePlan(day, signals, next);
    if (edit.approve && alreadyApproved) {
      reply = "Already running. I'll keep you posted.";
    } else if (edit.approve) {
      await applyPlan(day, signals, plan);
      plan.status = "approved";
      reply = `Starting now. First messages go out at ${timeLabel(parseHHMM(plan.firstWaveAt))} from your WhatsApp number, signed by ${day.merchant.front_desk_name}.`;
      await logEvent("plan_approved", { released: plan.releasedUnits, maxDiscount: plan.maxDiscount });
    } else if (edit.skip) {
      plan.status = "skipped";
      reply = edit.reply;
    } else if (next.maxDiscount !== undefined || next.keepOpen || next.excludedServices) {
      // Numbers in the reply come from the recomputed plan, not the model.
      const parts = [`${plan.releasedUnits} slots at up to ₹${plan.maxDiscount} off`];
      if (next.keepOpen) parts.push(`keeping ${next.keepOpen.map((t) => timeLabel(parseHHMM(t))).join(", ")} for walk-ins`);
      reply = `Done. ${parts.join(", ")}. Shall I start?`;
    } else reply = edit.reply;
    plan.history = [...plan.history, { from: "owner", text: String(text) }, { from: "agent", text: reply }];
  } else if (op === "approve" && alreadyApproved) {
    return NextResponse.json({ plan: day.demo.plan, reply: "", signals: summary(signals) });
  } else if (op === "approve") {
    await applyPlan(day, signals, plan);
    plan.status = "approved";
    reply = `Starting now. First messages go out at ${timeLabel(parseHHMM(plan.firstWaveAt))}.`;
    plan.history = [...plan.history, { from: "agent", text: reply }];
    await logEvent("plan_approved", { released: plan.releasedUnits, maxDiscount: plan.maxDiscount });
  } else if (op === "skip" || op === "pause" || op === "resume") {
    plan.status = op === "skip" ? "skipped" : op === "pause" ? "paused" : "approved";
    reply = op === "skip" ? "Okay, I'll sit today out." : op === "pause" ? "Paused. No new messages will go out." : "Back on.";
    await logEvent(`plan_${op}`, {});
  }

  await savePlan(plan);
  return NextResponse.json({ plan, reply, signals: summary(signals) });
}

const summary = (s: Awaited<ReturnType<typeof readSignals>>) => ({
  nearby: s.nearby, salons: s.salons, lastHour: s.lastHour, merchants: s.merchants,
  walkIns4pm: s.history.get(16) ?? 0,
});

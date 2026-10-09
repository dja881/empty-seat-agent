import { NextResponse } from "next/server";
import { db, logEvent, MERCHANT_ID, must } from "@/lib/server/db";
import { loadDay } from "@/lib/server/day";
import { proposePlan, readSignals, savePlan } from "@/lib/server/plan";

export async function GET() {
  const [m, s, c] = await Promise.all([
    db.from("merchants").select("*").eq("id", MERCHANT_ID).single(),
    db.from("services").select("*").eq("merchant_id", MERCHANT_ID).order("price"),
    db.from("customers").select("id, name").eq("merchant_id", MERCHANT_ID).order("name"),
  ]);
  return NextResponse.json({ merchant: must(m, "merchant"), services: must(s, "services"), customers: must(c, "customers") });
}

/** Screen 0: save the owner's limits. Every offer is checked against these before it's sent. */
export async function POST(req: Request) {
  const { merchant, services } = await req.json();
  const allowed = ["max_discount", "allowed_offers", "never_discount_services", "vip_customer_ids", "daily_message_cap",
    "quiet_hours_start", "quiet_hours_end", "approval_mode", "front_desk_name", "front_desk_phone"];
  const patch = Object.fromEntries(Object.entries(merchant ?? {}).filter(([k]) => allowed.includes(k)));
  if (typeof patch.max_discount === "number") patch.max_discount = Math.max(0, Math.min(1000, Math.round(patch.max_discount)));
  must(await db.from("merchants").update(patch).eq("id", MERCHANT_ID), "merchant");
  for (const s of services ?? []) {
    const floor = s.floor_price === null || s.floor_price === "" ? null : Math.max(0, Math.min(Number(s.price), Number(s.floor_price)));
    must(await db.from("services").update({ price: Number(s.price), floor_price: floor, discountable: !!s.discountable && floor !== null })
      .eq("id", s.id), "service");
  }
  await logEvent("settings_saved", { max_discount: patch.max_discount });

  // New limits change the next plan: rebuild it if it hasn't been approved yet.
  const day = await loadDay();
  if (day.demo.plan && day.demo.plan.status === "proposed") {
    const plan = await proposePlan(day, await readSignals(day), {
      maxDiscount: Math.min(day.demo.plan.maxDiscount, day.merchant.max_discount),
    });
    await savePlan(plan);
  }
  return NextResponse.json({ ok: true });
}

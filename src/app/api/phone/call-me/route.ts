import { NextResponse } from "next/server";
import { db, logEvent, must } from "@/lib/server/db";
import { loadDay } from "@/lib/server/day";
import { postMessage } from "@/lib/server/offers";

/** "Call Sneha": alerts the front desk and tells the customer a person will call. */
export async function POST(req: Request) {
  const { customerId } = await req.json();
  const day = await loadDay();
  const c = must(await db.from("customers").select("name").eq("id", customerId).single(), "customer") as { name: string };
  await logEvent("call_me", { customer: c.name, customer_id: customerId, reason: "Tapped Call" });
  await postMessage(day, customerId, "system", `${day.merchant.front_desk_name} at ${day.merchant.name} will call you in a few minutes.`);
  return NextResponse.json({ ok: true });
}

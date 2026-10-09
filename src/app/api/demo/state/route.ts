import { NextResponse } from "next/server";
import { db, MERCHANT_ID, must } from "@/lib/server/db";

/** Switch demo/live mode or the scripted switch. */
export async function POST(req: Request) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.mode === "demo" || body.mode === "live") patch.mode = body.mode;
  if (typeof body.scripted === "boolean") patch.scripted = body.scripted;
  must(await db.from("demo_state").update(patch).eq("merchant_id", MERCHANT_ID), "state");
  return NextResponse.json({ ok: true });
}

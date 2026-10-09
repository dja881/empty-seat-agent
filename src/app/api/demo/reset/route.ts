import { NextResponse } from "next/server";
import { db, must } from "@/lib/server/db";

/** Reset demo: restores the seeded day, the demo clock and the simulator. */
export async function POST() {
  must(await db.rpc("reset_demo_all"), "reset");
  return NextResponse.json({ ok: true });
}

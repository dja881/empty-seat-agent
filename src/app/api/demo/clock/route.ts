import { NextResponse } from "next/server";
import { advanceClock } from "@/lib/server/clock";

/** Move the demo clock forward. {to: "13:30", simulate?: ["sale" | "walk_in" | "call_me"]} (demo mode only) */
export async function POST(req: Request) {
  const { to, simulate } = await req.json();
  if (!/^\d{1,2}:\d{2}$/.test(to ?? "")) return NextResponse.json({ error: "to must be HH:MM" }, { status: 400 });
  return NextResponse.json(await advanceClock(to, { simulate: Array.isArray(simulate) ? simulate : [] }));
}

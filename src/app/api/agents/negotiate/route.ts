import { NextResponse } from "next/server";
import { loadDay } from "@/lib/server/day";
import { negotiate } from "@/lib/server/negotiate";

/** Screen 4: run a negotiation between Kavya's assistant and the salon agent. */
export async function POST(req: Request) {
  const { customerMax = 380 } = await req.json().catch(() => ({}));
  const day = await loadDay();
  return NextResponse.json(await negotiate(Math.max(200, Math.min(450, Number(customerMax))), day.demo.scripted));
}

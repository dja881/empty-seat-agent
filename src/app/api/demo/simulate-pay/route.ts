import { NextResponse } from "next/server";
import { loadDay } from "@/lib/server/day";
import { getOffer, settle } from "@/lib/server/settle";

/**
 * Demo mode only: a simulated customer pays an offer through the same settlement path as a
 * real payment, marked as simulated. In live mode every payment goes through Razorpay.
 */
export async function POST(req: Request) {
  const { offerId, variant = "any" } = await req.json();
  const day = await loadDay();
  if (day.demo.mode !== "demo") return NextResponse.json({ error: "demo mode only" }, { status: 403 });
  const o = await getOffer(offerId);
  const funded = variant === "bank" ? o.funded_amount : 0;
  const { result } = await settle(offerId, { orderId: null, paymentId: null, amount: o.price - funded, funded, simulated: true });
  return NextResponse.json({ result });
}

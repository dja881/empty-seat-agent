import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/server/razorpay";
import { settle } from "@/lib/server/settle";

/**
 * payment.captured webhook: the authoritative path in production. Safe to receive after
 * the Checkout handler already settled: the database reports a duplicate and nothing changes.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const event = JSON.parse(raw);
  if (event.event === "payment.captured") {
    const p = event.payload.payment.entity;
    const offerId = p.notes?.offer_id;
    if (offerId) {
      await settle(offerId, {
        orderId: p.order_id, paymentId: p.id, amount: Math.round(p.amount / 100),
        funded: p.notes?.variant === "bank" ? Number(p.notes?.funded ?? 0) : 0, simulated: false,
      });
    }
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { verifyCheckoutSignature } from "@/lib/server/razorpay";
import { getOffer, settle } from "@/lib/server/settle";

/**
 * Checkout success handler: verify Razorpay's signature, check the order belongs to this
 * offer, then settle. Amounts come from the offer, never from the browser.
 */
export async function POST(req: Request) {
  const { offerId, variant, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
  if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const o = await getOffer(offerId);
  if (o.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "order does not match offer" }, { status: 400 });
  }
  const funded = variant === "bank" ? o.funded_amount : 0;
  const { result } = await settle(offerId, {
    orderId: razorpay_order_id, paymentId: razorpay_payment_id,
    amount: o.price - funded, funded, simulated: false,
  });
  return NextResponse.json({ result });
}

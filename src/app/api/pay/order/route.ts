import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { loadDay } from "@/lib/server/day";
import { createOrder } from "@/lib/server/razorpay";
import { getOffer, stillOpen } from "@/lib/server/settle";

/** Create the Razorpay order for an offer. variant "bank" = HDFC card price, "any" = any method. */
export async function POST(req: Request) {
  const { offerId, variant } = await req.json();
  const [day, o] = await Promise.all([loadDay(), getOffer(offerId)]);
  if (o.status === "paid" || o.status === "cancelled" || !stillOpen(day, o)) {
    return NextResponse.json({ taken: true }, { status: 409 });
  }
  const bank = variant === "bank" && o.funded_amount > 0;
  const amount = o.price - (bank ? o.funded_amount : 0);
  const order = await createOrder(amount, `offer_${o.id.slice(0, 8)}`, {
    offer_id: o.id, variant: bank ? "bank" : "any", funded: String(bank ? o.funded_amount : 0),
  });
  await db.from("offers").update({ razorpay_order_id: order.id }).eq("id", o.id);
  return NextResponse.json({
    orderId: order.id,
    amount,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    customer: o.guest_name ?? o.customers?.name,
    phone: o.customers?.phone?.replace(/\s/g, ""),
    description: `${o.services?.name} · ${day.merchant.name}`,
    bankIssuer: bank ? "HDFC" : null,
  });
}

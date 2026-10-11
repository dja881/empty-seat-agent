import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { loadDay } from "@/lib/server/day";
import { createOrder } from "@/lib/server/razorpay";
import { fundedFor, getOffer, groupOf, stillOpen } from "@/lib/server/settle";

/** Create the Razorpay order for an offer. variant "bank" = HDFC card price, "any" = any method. */
export async function POST(req: Request) {
  const { offerId, variant } = await req.json();
  const [day, o] = await Promise.all([loadDay(), getOffer(offerId)]);
  const seats = await groupOf(o);
  if (o.status === "paid" || o.status === "cancelled" || seats.some((x) => !stillOpen(day, x))) {
    return NextResponse.json({ taken: true }, { status: 409 });
  }
  // One order for every seat in the booking (a customer bringing a friend pays once).
  const funded = seats.reduce((n, x) => n + fundedFor(x, variant), 0);
  const bank = o.funder_kind !== "brand" && funded > 0;
  const amount = seats.reduce((n, x) => n + x.price, 0) - funded;
  const order = await createOrder(amount, `offer_${o.id.slice(0, 8)}`, {
    offer_id: o.id, variant: bank ? "bank" : "any", funded: String(funded), seats: String(seats.length),
  });
  await db.from("offers").update({ razorpay_order_id: order.id }).eq("id", o.id);
  return NextResponse.json({
    orderId: order.id,
    amount,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    customer: o.guest_name ?? o.customers?.name,
    phone: o.customers?.phone?.replace(/\s/g, ""),
    description: `${seats.length > 1 ? `${seats.length} × ` : ""}${o.services?.name} · ${day.merchant.name}`,
    bankIssuer: bank ? "HDFC" : null,
  });
}

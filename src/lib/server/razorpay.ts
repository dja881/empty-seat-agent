import "server-only";
import crypto from "node:crypto";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
const SECRET = process.env.RAZORPAY_KEY_SECRET!;
const auth = "Basic " + Buffer.from(`${KEY_ID}:${SECRET}`).toString("base64");

async function rzp<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Razorpay ${path}: ${json?.error?.description ?? res.status}`);
  return json as T;
}

/** Orders API. Amount in rupees; notes carry the offer so the webhook can settle it. */
export function createOrder(amountRupees: number, receipt: string, notes: Record<string, string>) {
  return rzp<{ id: string; amount: number }>("/orders", {
    amount: amountRupees * 100,
    currency: "INR",
    receipt,
    notes,
  });
}

export function refundPayment(paymentId: string, amountRupees: number, reason: string) {
  return rzp<{ id: string }>(`/payments/${paymentId}/refund`, {
    amount: amountRupees * 100,
    notes: { reason },
  });
}

const safeEqual = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Signature Checkout returns to the browser: HMAC(order_id|payment_id, key secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const expected = crypto.createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

/** X-Razorpay-Signature on webhooks: HMAC(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

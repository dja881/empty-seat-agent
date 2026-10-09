import { NextResponse } from "next/server";
import { handleCustomerMessage } from "@/lib/server/salonAgent";

/** The customer sent a WhatsApp message from the phone view. */
export async function POST(req: Request) {
  const { customerId, text } = await req.json();
  if (!customerId || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "customerId and text required" }, { status: 400 });
  }
  try {
    await handleCustomerMessage(customerId, text.trim().slice(0, 500));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

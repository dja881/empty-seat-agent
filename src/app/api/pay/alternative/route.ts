import { NextResponse } from "next/server";
import { db, must } from "@/lib/server/db";
import { loadDay, sellableTimes, type CustomerRow } from "@/lib/server/day";
import { createOffer, refreshOffered } from "@/lib/server/offers";
import { getOffer } from "@/lib/server/settle";

/** From the "slot taken" page: same service and price at another open time. */
export async function POST(req: Request) {
  const { offerId, start } = await req.json();
  const [day, o] = await Promise.all([loadDay(), getOffer(offerId)]);
  const service = day.services.find((s) => s.id === o.service_id)!;
  const t = sellableTimes(day, service.duration_min).find((x) => x.start === Number(start));
  if (!t) return NextResponse.json({ taken: true }, { status: 409 });
  const customer = must(await db.from("customers").select("*").eq("id", o.customer_id).single(), "customer") as CustomerRow;
  const { offer } = await createOffer(day, {
    customer, service, chair: t.chairs[0], start: t.start, end: t.start + service.duration_min,
    price: o.price, wave: 2, guestName: o.guest_name, groupId: o.group_id,
  });
  await db.from("offers").update({ status: "link_sent" }).eq("id", offer.id);
  await refreshOffered();
  return NextResponse.json({ offerId: offer.id });
}

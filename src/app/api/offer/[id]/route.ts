import { NextResponse } from "next/server";
import { loadDay } from "@/lib/server/day";
import { alternatives, getOffer, groupOf, stillOpen } from "@/lib/server/settle";
import { istMinutes } from "@/lib/time";

/** Everything the pay page needs about one offer. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [day, o] = await Promise.all([loadDay(), getOffer(id)]);
  const seats = await groupOf(o);
  const open = o.status !== "paid" && o.status !== "cancelled" && seats.every((x) => stillOpen(day, x));
  return NextResponse.json({
    id: o.id,
    status: o.status,
    open,
    customer: o.guest_name ?? o.customers?.name,
    phone: o.customers?.phone,
    service: o.services?.name,
    start: istMinutes(o.start_at),
    stylist: day.merchant.stylists[o.chair - 1],
    chair: o.chair,
    // Totals for every seat this link pays for.
    price: seats.reduce((n, x) => n + x.price, 0),
    funded: seats.reduce((n, x) => n + x.funded_amount, 0),
    seats: seats.map((x) => ({ name: x.guest_name ?? x.customers?.name, chair: x.chair, stylist: day.merchant.stylists[x.chair - 1] })),
    funderKind: o.funder_kind,
    funder: o.funder,
    salon: { name: day.merchant.name, frontDesk: day.merchant.front_desk_name, phone: day.merchant.front_desk_phone },
    alternatives: open ? [] : alternatives(day, o),
  });
}

import { NextResponse } from "next/server";
import { loadDay } from "@/lib/server/day";
import { finishWave, previewWave, sendOne, sendWave, setClock } from "@/lib/server/waves";
import { timeLabel } from "@/lib/server/day";

/** GET: who wave 1 goes to and why. POST {wave, clock?}: send it (demo mode can jump the clock first). */
export async function GET(req: Request) {
  const day = await loadDay();
  if (new URL(req.url).searchParams.get("sent")) return NextResponse.json(await sentWave(day));
  const { rows, excludedCounts, checked, eligible } = await previewWave(day);
  return NextResponse.json({
    checked, eligible, excludedCounts,
    rows: rows.map((r) => ({
      customerId: r.candidate.customer.id,
      serviceId: r.service.id,
      start: r.start,
      name: r.candidate.customer.name,
      reasons: r.candidate.reasons,
      score: r.candidate.score,
      service: r.service.name,
      duration: r.service.duration_min,
      time: timeLabel(r.start),
      chair: r.chair,
      stylist: day.merchant.stylists[r.chair - 1],
      price: r.price,
      list: r.service.price,
      hdfc: r.candidate.customer.card_issuer === "HDFC",
    })),
  });
}

/**
 * POST {wave, clock?}                 send the whole wave at once
 * POST {wave, clock?, row}            send one customer's offer (the dashboard sends them one by one)
 * POST {wave, finish: true, count}    mark the wave as sent
 */
export async function POST(req: Request) {
  const { wave = 1, clock, row, finish, count } = await req.json().catch(() => ({}));
  if (clock) await setClock(clock);
  if (row) return NextResponse.json({ offerId: await sendOne(wave, row) });
  if (finish) { await finishWave(wave, Number(count) || 0); return NextResponse.json({ ok: true }); }
  const sent = await sendWave(wave);
  return NextResponse.json({ sent });
}

/** Wave 1 as it went out, with where each offer stands now (for coming back to this screen). */
async function sentWave(day: Awaited<ReturnType<typeof loadDay>>) {
  const { db, must } = await import("@/lib/server/db");
  const { rankCustomers } = await import("@/lib/server/plan");
  const { customersAndOffered } = await import("@/lib/server/waves");
  const { istMinutes } = await import("@/lib/time");
  const offers = must(await db.from("offers").select("*, customers(*), services(name, duration_min)").eq("wave", 1).order("created_at"), "offers") as
    { customer_id: string; status: string; chair: number; start_at: string; price: number; list_price: number; service_id: string;
      customers: { name: string; card_issuer: string | null }; services: { name: string; duration_min: number } }[];
  const all = must(await db.from("offers").select("customer_id, status"), "all offers") as { customer_id: string; status: string }[];
  const replied = new Set((must(await db.from("messages").select("customer_id").eq("sender", "customer"), "replies") as { customer_id: string }[]).map((m) => m.customer_id));
  const { customers } = await customersAndOffered(day);
  const reasons = new Map(rankCustomers(day, customers, new Set()).map((r) => [r.customer.id, r.reasons]));
  const seen = new Set<string>();
  const rows = offers.filter((o) => (seen.has(o.customer_id) ? false : (seen.add(o.customer_id), true))).map((o) => {
    const statuses = all.filter((a) => a.customer_id === o.customer_id).map((a) => a.status);
    const status = statuses.includes("paid") ? "paid" : replied.has(o.customer_id) ? "replied" : "sent";
    return {
      customerId: o.customer_id, serviceId: o.service_id, start: istMinutes(o.start_at), name: o.customers.name,
      reasons: reasons.get(o.customer_id) ?? [], score: 0, service: o.services.name, duration: o.services.duration_min,
      time: timeLabel(istMinutes(o.start_at)), chair: o.chair, stylist: day.merchant.stylists[o.chair - 1],
      price: o.price, list: o.list_price, hdfc: o.customers.card_issuer === "HDFC", status,
    };
  });
  return { checked: customers.length, eligible: rows.length, excludedCounts: {}, rows, sent: true };
}

import { NextResponse } from "next/server";
import { loadDay } from "@/lib/server/day";
import { previewWave, sendWave, setClock } from "@/lib/server/waves";
import { timeLabel } from "@/lib/server/day";

/** GET: who wave 1 goes to and why. POST {wave, clock?}: send it (demo mode can jump the clock first). */
export async function GET() {
  const day = await loadDay();
  const { rows, excludedCounts, checked, eligible } = await previewWave(day);
  return NextResponse.json({
    checked, eligible, excludedCounts,
    rows: rows.map((r) => ({
      customerId: r.candidate.customer.id,
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

export async function POST(req: Request) {
  const { wave = 1, clock } = await req.json().catch(() => ({}));
  if (clock) await setClock(clock);
  const sent = await sendWave(wave);
  return NextResponse.json({ sent });
}

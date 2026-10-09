import "server-only";
import { db, MERCHANT_ID, must } from "./db";
import { atMinutes, parseHHMM, timeLabel, type CustomerRow, type Day, type Plan, type SlotRow } from "./day";
import { istMinutes } from "../time";
import { emptySlotCount, slotUnits } from "../slots";
import type { Slot } from "../types";

/* ---------------- signals ---------------- */

export async function readSignals(day: Day) {
  const [profile, foot] = await Promise.all([
    db.rpc("walkin_profile", { p_merchant: MERCHANT_ID, p_date: day.demo.demo_date }),
    db.rpc("footfall_vs_normal", {
      p_area: day.merchant.area_id, p_date: day.demo.demo_date,
      p_upto_hour: Math.max(8, Math.floor(day.now / 60) - 1),
    }),
  ]);
  const history = new Map<number, number>((must(profile, "walkins") as { hour: number; avg_walkins: number }[])
    .map((r) => [r.hour, Number(r.avg_walkins)]));
  const rows = must(foot, "footfall") as { scope: string; ratio: number | null; merchants: number }[];
  const get = (scope: string) => Number(rows.find((r) => r.scope === scope)?.ratio ?? 1);
  return {
    history,
    nearby: get("nearby"),
    salons: get("salons"),
    lastHour: get("last_hour"),
    merchants: rows.find((r) => r.scope === "nearby")?.merchants ?? 0,
  };
}
export type Signals = Awaited<ReturnType<typeof readSignals>>;

const pct = (ratio: number) => Math.round((ratio - 1) * 20) * 5; // nearest 5%

/* ---------------- forecast and hold/release ---------------- */

interface Segment { chair: number; start: number; end: number; slotId: string; walkInProb: number; hold: boolean }

/**
 * Walk-in forecast = salon's own same-weekday history, scaled by today's footfall around
 * the salon. For each hour, hold as many free chairs as walk-ins expected; release the rest.
 * Walk-ins are absorbed by the chairs held, so the buffer stays small.
 */
export function forecast(day: Day, signals: Signals, keepOpen: string[] = []) {
  const earliest = day.now + 60;
  const segments: Segment[] = [];
  for (const s of day.slots) {
    if (!["free", "held", "released", "offered"].includes(s.state)) continue;
    const a = Math.max(istMinutes(s.start_at), earliest), b = istMinutes(s.end_at);
    for (let t = Math.ceil(a / 30) * 30; t + 30 <= b; t += 30) {
      segments.push({ chair: s.chair, start: t, end: t + 30, slotId: s.id, walkInProb: 0, hold: false });
    }
  }

  let expectedWalkIns = 0;
  const hours = [...new Set(segments.map((g) => Math.floor(g.start / 60)))];
  for (const h of hours) {
    const expected = (signals.history.get(h) ?? 0) * signals.nearby;
    expectedWalkIns += expected;
    const inHour = segments.filter((g) => Math.floor(g.start / 60) === h);
    const chairs = [...new Set(inHour.map((g) => g.chair))].sort((x, y) => y - x); // hold from the last chair
    const holdN = Math.min(chairs.length, Math.round(expected));
    const prob = Math.min(0.95, expected / Math.max(chairs.length, 1));
    for (const g of inHour) {
      g.walkInProb = Math.round(prob * 100) / 100;
      g.hold = chairs.indexOf(g.chair) < holdN;
    }
  }
  for (const t of keepOpen) {
    const m = parseHHMM(t);
    for (const g of segments) if (g.start <= m && g.end > m) g.hold = true;
  }

  // Count in sellable slots, the same way the header counts empty slots.
  const runs = mergeRuns(segments);
  const heldUnits = runs.filter((r) => r.hold).reduce((n, r) => n + slotUnits(r.end - r.start), 0);
  const releasedUnits = runs.filter((r) => !r.hold).reduce((n, r) => n + slotUnits(r.end - r.start), 0);
  const heldHours = describeHours(runs.filter((r) => r.hold));
  return { segments, runs, heldUnits, releasedUnits, expectedWalkIns, heldHours };
}

function mergeRuns(segments: Segment[]) {
  const sorted = [...segments].sort((a, b) => a.chair - b.chair || a.start - b.start);
  const runs: { chair: number; start: number; end: number; hold: boolean; prob: number }[] = [];
  for (const g of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.chair === g.chair && last.end === g.start && last.hold === g.hold) {
      last.end = g.end; last.prob = Math.max(last.prob, g.walkInProb);
    } else runs.push({ chair: g.chair, start: g.start, end: g.end, hold: g.hold, prob: g.walkInProb });
  }
  return runs;
}

/** The busiest walk-in window: consecutive hours holding at least half the peak hour's chairs. */
function describeHours(runs: { start: number; end: number }[]) {
  if (!runs.length) return "none";
  const perHour = new Map<number, number>();
  for (const r of runs) for (let t = r.start; t < r.end; t += 30) perHour.set(Math.floor(t / 60), (perHour.get(Math.floor(t / 60)) ?? 0) + 30);
  const peak = Math.max(...perHour.values());
  const peakHour = [...perHour.entries()].find(([, v]) => v === peak)![0];
  let a = peakHour, b = peakHour;
  while ((perHour.get(a - 1) ?? 0) >= peak / 2) a--;
  while ((perHour.get(b + 1) ?? 0) >= peak / 2) b++;
  return `${timeLabel(a * 60).replace(/ (am|pm)$/, "")} to ${timeLabel((b + 1) * 60)}`;
}

/* ---------------- the morning plan ---------------- */

export async function proposePlan(day: Day, signals: Signals, overrides: Partial<Plan> = {}): Promise<Plan> {
  const prev = day.demo.plan;
  const maxDiscount = overrides.maxDiscount ?? prev?.maxDiscount ?? day.merchant.max_discount;
  const keepOpen = overrides.keepOpen ?? prev?.keepOpen ?? [];
  const f = forecast(day, signals, keepOpen);
  // Open slots match the header count; whatever isn't released is left for walk-ins.
  const openUnits = emptySlotCount(day.slots as unknown as Slot[]);
  const heldUnits = openUnits - f.releasedUnits;
  // Base case: about 30% of released time sells, at roughly ₹470 a slot after discount.
  const expectedRevenue = Math.round((f.releasedUnits * 0.3 * 470) / 100) * 100;
  return {
    status: overrides.status ?? prev?.status ?? "proposed",
    maxDiscount,
    releasedUnits: f.releasedUnits,
    heldUnits,
    openUnits,
    expectedWalkIns: Math.round(f.expectedWalkIns),
    expectedRevenue,
    footfallPct: pct(signals.nearby),
    salonsPct: pct(signals.salons),
    heldHours: f.heldHours,
    excludedServices: overrides.excludedServices ?? prev?.excludedServices ?? [],
    keepOpen,
    firstWaveAt: overrides.firstWaveAt ?? prev?.firstWaveAt ?? "11:30",
    history: overrides.history ?? prev?.history ?? [],
  };
}

export async function savePlan(plan: Plan) {
  must(await db.from("demo_state").update({ plan, updated_at: new Date().toISOString() })
    .eq("merchant_id", MERCHANT_ID), "save plan");
}

/** On approval: write held and released time onto the chair board. */
export async function applyPlan(day: Day, signals: Signals, plan: Plan) {
  const f = forecast(day, signals, plan.keepOpen);
  const touched = new Set(f.segments.map((g) => g.slotId));
  const date = day.demo.demo_date;
  const rows: Partial<SlotRow & { merchant_id: string }>[] = [];
  for (const id of touched) {
    const s = day.slots.find((x) => x.id === id)!;
    const a = istMinutes(s.start_at), b = istMinutes(s.end_at);
    const runs = f.runs.filter((r) => r.chair === s.chair && r.start >= a && r.end <= b);
    const first = runs[0]?.start ?? b, last = runs[runs.length - 1]?.end ?? a;
    // Edges before the release cutoff or off the half hour stay as they were.
    if (first - a >= 20) rows.push({ merchant_id: MERCHANT_ID, chair: s.chair, start_at: s.start_at, end_at: atMinutes(date, first), state: s.state });
    for (const r of runs) {
      rows.push({ merchant_id: MERCHANT_ID, chair: r.chair, start_at: atMinutes(date, r.start), end_at: atMinutes(date, r.end),
        state: r.hold ? "held" : "released", walk_in_prob: r.prob });
    }
    if (b - last >= 20) rows.push({ merchant_id: MERCHANT_ID, chair: s.chair, start_at: atMinutes(date, last), end_at: s.end_at, state: s.state });
  }
  must(await db.from("slots").delete().in("id", [...touched]), "clear blocks");
  if (rows.length) must(await db.from("slots").insert(rows), "write plan");
}

/* ---------------- choosing customers ---------------- */

export interface Candidate {
  customer: CustomerRow;
  score: number;
  reasons: string[];
  excluded?: string;
}

const BAND_HOUR = { morning: 11 * 60, afternoon: 15 * 60, evening: 18 * 60 };

/** Rank the salon's own customers: due for a visit, close by, free at that hour, likely to respond. */
export function rankCustomers(day: Day, customers: CustomerRow[], alreadyOffered: Set<string>) {
  const today = new Date(day.demo.clock_at).getTime();
  const out: Candidate[] = [];
  for (const c of customers) {
    const days = Math.round((today - new Date(c.last_visit_at).getTime()) / 86400000);
    const due = days / c.usual_gap_days;
    const reasons = [`${c.distance_km} km`, days > c.usual_gap_days * 2 ? `Lapsed: ${Math.round(days / 7)} wks` : `Due: ${Math.round(days / 7)} wks`];
    if (c.usual_time_band === "afternoon") reasons.push("Afternoons");
    if (c.past_offer_response >= 0.5) reasons.push("Took last offer");
    let excluded: string | undefined;
    if (c.opted_out) excluded = "Opted out";
    else if (day.merchant.vip_customer_ids.includes(c.id)) excluded = "VIP, never discount";
    else if (c.is_regular) excluded = "Regular, pays full price";
    else if (c.distance_km > 8) excluded = "More than 8 km away";
    else if (due < 0.85) excluded = "Visited recently";
    else if (alreadyOffered.has(c.id)) excluded = "Already offered today";
    const score = Math.min(due, 2) * 0.35 + (1 - c.distance_km / 8) * 0.25 + c.past_offer_response * 0.3
      + (c.usual_time_band === "afternoon" ? 0.1 : 0) - (due > 2 ? 0.15 : 0);
    out.push({ customer: c, score: Math.round(score * 100) / 100, reasons, excluded });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Match each chosen customer to a released time for their usual service, near their usual hour. */
export function matchTimes(day: Day, picks: Candidate[], durationOf: (serviceId: string) => number, perTime = 3) {
  const used = new Map<string, number>(); // `${chair}@${start}` -> customers offered
  const byTime = new Map<number, number>(); // start -> customers offered across chairs
  const matches: { candidate: Candidate; chair: number; start: number; end: number }[] = [];
  const free = day.slots.filter((s) => ["released", "offered"].includes(s.state));
  const earliest = day.now + 60;
  for (const p of picks) {
    const dur = durationOf(p.customer.usual_service_id);
    const target = BAND_HOUR[p.customer.usual_time_band];
    let best: { chair: number; start: number; dist: number } | null = null;
    for (const s of free) {
      const a = istMinutes(s.start_at), b = istMinutes(s.end_at);
      for (let t = Math.ceil(Math.max(a, earliest) / 30) * 30; t + dur <= b; t += 30) {
        const key = `${s.chair}@${t}`;
        if ((used.get(key) ?? 0) >= perTime) continue;
        // spread customers across times so one slot isn't offered to everyone
        const dist = Math.abs(t - target) + (byTime.get(t) ?? 0) * 45 + (used.get(key) ?? 0) * 10;
        if (!best || dist < best.dist) best = { chair: s.chair, start: t, dist };
      }
    }
    if (!best) continue;
    const key = `${best.chair}@${best.start}`;
    used.set(key, (used.get(key) ?? 0) + 1);
    byTime.set(best.start, (byTime.get(best.start) ?? 0) + 1);
    matches.push({ candidate: p, chair: best.chair, start: best.start, end: best.start + dur });
  }
  return matches;
}

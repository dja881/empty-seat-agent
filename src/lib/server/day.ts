import "server-only";
import { db, MERCHANT_ID, must } from "./db";
import { istDayRange, istMinutes } from "../time";

export interface MerchantRow {
  id: string; name: string; owner_name: string; area_id: string; stylists: string[];
  opens_at: string; closes_at: string; max_discount: number; allowed_offers: string[];
  never_discount_services: string[]; vip_customer_ids: string[]; daily_message_cap: number;
  approval_mode: string; front_desk_name: string; front_desk_phone: string;
}
export interface ServiceRow { id: string; name: string; duration_min: number; price: number; floor_price: number | null; discountable: boolean }
export interface SlotRow { id: string; chair: number; start_at: string; end_at: string; state: string; walk_in_prob: number | null }
export interface CustomerRow {
  id: string; name: string; phone: string; distance_km: number; last_visit_at: string; usual_gap_days: number;
  usual_time_band: "morning" | "afternoon" | "evening"; usual_service_id: string; avg_spend: number;
  past_offer_response: number; card_issuer: string | null; is_regular: boolean; opted_out: boolean;
}
export interface FunderRow { id: string; funder: string; card_issuer: string; max_funded_amount: number; min_ticket: number }
export interface DemoRow { demo_date: string; clock_at: string; mode: "demo" | "live"; scripted: boolean; sim_step: number; plan: Plan | null }

export interface Plan {
  status: "proposed" | "approved" | "skipped" | "paused";
  maxDiscount: number;
  releasedUnits: number;
  heldUnits: number;
  openUnits: number;
  expectedWalkIns: number;
  expectedRevenue: number;
  footfallPct: number;          // today vs normal, e.g. -20
  salonsPct: number;            // nearby salons vs normal
  heldHours: string;            // "4 to 6 pm"
  excludedServices: string[];
  keepOpen: string[];           // times the owner asked to keep for walk-ins, "16:00"
  firstWaveAt: string;          // "11:30"
  history: { from: string; text: string }[];
}

export async function loadDay() {
  const [merchant, services, demo, funders] = await Promise.all([
    db.from("merchants").select("*").eq("id", MERCHANT_ID).single().then((r) => must(r, "merchant") as MerchantRow),
    db.from("services").select("*").eq("merchant_id", MERCHANT_ID).then((r) => must(r, "services") as ServiceRow[]),
    db.from("demo_state").select("*").eq("merchant_id", MERCHANT_ID).single().then((r) => must(r, "demo") as DemoRow),
    db.from("funder_offers").select("*").then((r) => must(r, "funders") as FunderRow[]),
  ]);
  const { from, to } = istDayRange(demo.demo_date);
  const slots = must(await db.from("slots").select("*").eq("merchant_id", MERCHANT_ID)
    .gte("start_at", from).lt("start_at", to).order("start_at"), "slots") as SlotRow[];
  return { merchant, services, demo, funders, slots, now: istMinutes(demo.clock_at) };
}
export type Day = Awaited<ReturnType<typeof loadDay>>;

/** "2026-10-13" + 900 → ISO timestamp for 3 pm IST that day. */
export function atMinutes(date: string, min: number) {
  const hh = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00+05:30`).toISOString();
}

export function timeLabel(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`;
}

export const parseHHMM = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

/**
 * Times today a service can still be sold: inside released or offered time, starting on
 * the quarter hour, at least an hour from now (release stops 1 hour before the slot).
 * Returns each start time with the chairs that can take it.
 */
export function sellableTimes(day: Day, durationMin: number, opts: { step?: number; includeHeld?: boolean } = {}) {
  const step = opts.step ?? 15;
  const states = opts.includeHeld ? ["released", "offered", "held"] : ["released", "offered"];
  const earliest = day.now + 60;
  const byStart = new Map<number, number[]>();
  for (const s of day.slots) {
    if (!states.includes(s.state)) continue;
    const a = istMinutes(s.start_at), b = istMinutes(s.end_at);
    for (let t = Math.ceil(Math.max(a, earliest) / step) * step; t + durationMin <= b; t += step) {
      byStart.set(t, [...(byStart.get(t) ?? []), s.chair]);
    }
  }
  return [...byStart.entries()].sort((x, y) => x[0] - y[0]).map(([start, chairs]) => ({ start, chairs }));
}

export function slotForChair(day: Day, chair: number, start: number, end: number) {
  return day.slots.find((s) => s.chair === chair && istMinutes(s.start_at) <= start && istMinutes(s.end_at) >= end
    && ["released", "offered", "held", "free"].includes(s.state));
}

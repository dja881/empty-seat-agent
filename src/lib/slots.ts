import type { Slot } from "./types";

/**
 * How many sellable slots a free block holds. Services run 20 to 90 minutes, so a
 * 20-39 minute gap still fits a beard trim, and longer blocks count roughly one slot
 * per 50 minutes (a mix of haircuts and hair spas). Matches scripts/gen-seed.mjs.
 */
export function slotUnits(minutes: number): number {
  if (minutes < 20) return 0;
  if (minutes < 40) return 1;
  return Math.floor((minutes + 10) / 50);
}

export const blockMinutes = (s: Pick<Slot, "start_at" | "end_at">) =>
  (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60000;

const UNSOLD = new Set(["free", "held", "released", "offered"]);

/** Empty slots still unsold, ignoring blocks that were split into children. */
export function emptySlotCount(slots: Slot[]): number {
  const parents = new Set(slots.map((s) => s.parent_slot_id).filter(Boolean));
  return slots
    .filter((s) => UNSOLD.has(s.state) && !parents.has(s.id))
    .reduce((n, s) => n + slotUnits(blockMinutes(s)), 0);
}

export function soldRevenue(slots: Slot[]): number {
  return slots.filter((s) => s.state === "paid").reduce((n, s) => n + (s.sold_price ?? 0), 0);
}

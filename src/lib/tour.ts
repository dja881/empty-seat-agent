"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The guided tour: ten tooltips that walk a first-time visitor through the demo day.
 * Each screen declares which step matches what is on it right now (useTourStep); the
 * overlay shows that step. Tips can be switched off, which removes the tour entirely.
 */
export interface TourStep {
  targets: string[];            // data-tour names, shown one after another within the step
  fallback?: string;            // shown instead when the target isn't on screen
  copy: string[];               // one line per target
  click?: boolean;              // Next presses the target (the step's action is a button)
  side?: "bottom" | "top" | "left" | "right";
  delay?: number;               // ms to wait before showing, so the result of the last action is seen first
}

export const TOUR: TourStep[] = [
  { targets: ["open-salon"], copy: ["You're the owner of a 6-chair salon with 32 empty slots today. Let's fill them."], click: true },
  { targets: ["start-day"], copy: ["RAY reads today's bookings and the street outside, then suggests a plan."], click: true },
  { targets: ["plan-input"], copy: ["Try changing the plan in plain words, like \"make it ₹100\"."], side: "top" },
  { targets: ["approve-plan"], copy: ["Nothing goes out until you approve."], click: true, side: "left" },
  { targets: ["offers-list", "send-offers"], click: true,
    copy: ["RAY picks customers who are due, nearby and free that afternoon. Regulars and VIPs are left out.", "Send the offers. They go out one by one on WhatsApp, in Sneha's name."] },
  { targets: ["customer-phone"], copy: ["This is what your customer sees. Tap the message and reply as Riya."], side: "left" },
  { targets: ["pay-button"], fallback: "customer-phone", copy: ["Pay in test mode. Watch the chair turn green on the left."], side: "left" },
  { targets: ["skip-time"], copy: ["Fast-forward the day. RAY adjusts when foot traffic drops."], click: true, delay: 4500 },
  { targets: ["close-day"], copy: ["See whether today made money."], click: true, delay: 6000 },
  { targets: ["extra-revenue"], copy: ["This is money you wouldn't have made without RAY, after RAY's fee."] },
];

interface State { on: boolean; auto: number | null; manual: number | null; sub: number; finished: boolean }
let state: State = { on: true, auto: null, manual: null, sub: 0, finished: false };
const SERVER: State = state;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
// The Tips choice lasts across visits; "finished" only until the demo is restarted.
const remember = (on: boolean) => { try { localStorage.setItem("tips", on ? "on" : "off"); } catch {} };
const markFinished = (done: boolean) => { try { if (done) sessionStorage.setItem("tour-finished", "1"); else sessionStorage.removeItem("tour-finished"); } catch {} };

let loaded = false;
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { set({ on: localStorage.getItem("tips") !== "off", finished: sessionStorage.getItem("tour-finished") === "1" }); } catch {}
}

export const tour = {
  /** Tips on or off. Turning them on resumes at the step that matches the current screen. */
  setOn(on: boolean) { remember(on); markFinished(false); set({ on, manual: null, sub: 0, finished: false }); },
  next() {
    const i = current();
    if (i === null) return;
    if (state.sub < TOUR[i].targets.length - 1) return set({ sub: state.sub + 1 });
    if (i === TOUR.length - 1) { markFinished(true); return set({ finished: true }); }
    set({ manual: i + 1, sub: 0 });
  },
  back() {
    const i = current();
    if (i === null) return;
    if (state.sub > 0) return set({ sub: state.sub - 1 });
    if (i > 0) set({ manual: i - 1, sub: 0 });
  },
  /** A fresh demo run: the tour starts again (the Tips setting is kept). */
  restart() { markFinished(false); set({ manual: null, sub: 0, finished: false }); },
};

function current() { return state.manual ?? state.auto; }

export function useTour() {
  const s = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => SERVER);
  useEffect(load, []);
  return { ...s, step: s.on && !s.finished ? s.manual ?? s.auto : null };
}

/** Declared by each screen: the step (1 to 10) that matches what is on it now, or null for none. */
export function useTourStep(step: number | null) {
  useEffect(() => {
    const auto = step === null ? null : step - 1;
    if (auto !== state.auto) set({ auto, manual: null, sub: 0 });
  }, [step]);
  useEffect(() => () => set({ auto: null, manual: null, sub: 0 }), []);
}

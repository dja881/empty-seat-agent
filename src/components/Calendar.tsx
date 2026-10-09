"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardData } from "@/lib/useBoardData";
import type { Slot } from "@/lib/types";
import { hhmmToMinutes, istMinutes, rupees } from "@/lib/time";

const AVATAR_TINTS = ["#fde2e4", "#dbeafe", "#e0e7ff", "#dcfce7", "#fef3c7", "#fce7f3"];

const fmt = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  return m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`;
};
const hourLabel = (min: number) => `${fmt(min)} ${min < 720 ? "am" : "pm"}`;

/**
 * Day view, calm by design: booked time is one quiet grey run per chair, so the eye only
 * follows empty time and what the agent does with it (offered, kept for walk-ins, sold).
 */
export function Calendar({ data, pxPerMin = 0.95 }: { data: BoardData; pxPerMin?: number }) {
  const { merchant, demo, bookings, slots } = data;
  const open = hhmmToMinutes(merchant.opens_at);
  const close = hhmmToMinutes(merchant.closes_at);
  const height = (close - open) * pxPerMin;
  const y = (min: number) => (min - open) * pxPerMin;
  const now = istMinutes(demo.clock_at);

  const parents = new Set(slots.map((s) => s.parent_slot_id).filter(Boolean));
  const visibleSlots = slots.filter((s) => !parents.has(s.id) && s.state !== "cancelled");
  const flashing = useJustSold(slots);

  const hours: number[] = [];
  for (let m = open; m <= close; m += 60) hours.push(m);

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className="min-w-[640px]">
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="w-14 shrink-0" />
          {merchant.stylists.map((name, i) => (
            <div key={name} className="flex min-w-0 flex-1 items-center gap-2 border-l border-line px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-ink-2"
                style={{ background: AVATAR_TINTS[i % AVATAR_TINTS.length] }}>{name[0]}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{name}</span>
                <span className="block text-[11px] text-muted">Chair {i + 1}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex" style={{ height }}>
          <div className="relative w-14 shrink-0">
            {hours.map((m) => m < close && m > open && (
              <span key={m} className="tnum absolute right-2 -translate-y-1/2 text-[11px] text-faint" style={{ top: y(m) }}>{hourLabel(m)}</span>
            ))}
          </div>

          {merchant.stylists.map((name, idx) => {
            const chair = idx + 1;
            const runs = bookedRuns(bookings.filter((b) => b.chair === chair && (b.source === "crm" || b.source === "walk_in"))
              .map((b) => ({ a: istMinutes(b.start_at), b: istMinutes(b.end_at), walkIn: b.source === "walk_in" })));
            return (
              <div key={name} className="relative min-w-0 flex-1 border-l border-line">
                {hours.slice(1, -1).map((m) => <div key={m} className="absolute inset-x-0 border-t border-line/70" style={{ top: y(m) }} />)}
                {runs.map((r, i) => (
                  <div key={i} className="absolute inset-x-1.5 rounded-md bg-[#eef0f3]" style={{ top: y(r.a) + 1.5, height: (r.b - r.a) * pxPerMin - 3 }}>
                    {r.walkIn && (r.b - r.a) >= 40 && <span className="block px-2 pt-1.5 text-[11px] font-medium text-muted">Walk-in</span>}
                  </div>
                ))}
                {visibleSlots.filter((s) => s.chair === chair).map((s) => (
                  <OpenTime key={s.id} slot={s} flash={flashing.has(s.id)}
                    top={y(istMinutes(s.start_at))} minutes={istMinutes(s.end_at) - istMinutes(s.start_at)} pxPerMin={pxPerMin} />
                ))}
              </div>
            );
          })}

          {now > open && (
            <div className="pointer-events-none absolute inset-y-0 left-14 right-0">
              <div className="absolute inset-x-0 top-0 bg-white/55" style={{ height: y(Math.min(now, close)) }} />
            </div>
          )}
          {now > open && now < close && (
            <div className="pointer-events-none absolute left-0 right-0 z-[5] flex items-center" style={{ top: y(now) }}>
              <span className="tnum w-14 pr-1 text-right text-[10px] font-semibold text-danger">{fmt(now)}</span>
              <span className="h-2 w-2 -translate-x-1 rounded-full bg-danger" />
              <span className="h-px flex-1 bg-danger" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Merge back-to-back appointments (gaps under 20 min) into one grey run. Walk-ins stay separate. */
function bookedRuns(items: { a: number; b: number; walkIn: boolean }[]) {
  const sorted = items.sort((x, y) => x.a - y.a);
  const runs: { a: number; b: number; walkIn: boolean }[] = [];
  for (const it of sorted) {
    const last = runs[runs.length - 1];
    if (last && !it.walkIn && !last.walkIn && it.a - last.b < 20) last.b = Math.max(last.b, it.b);
    else runs.push({ ...it });
  }
  return runs;
}

function OpenTime({ slot, flash, top, minutes, pxPerMin }: { slot: Slot; flash: boolean; top: number; minutes: number; pxPerMin: number }) {
  const h = minutes * pxPerMin;
  const pos = { top: top + 1.5, height: h - 3 };
  const box = "absolute inset-x-1.5 overflow-hidden rounded-md px-2 pt-1.5 leading-tight transition-colors duration-500";
  const big = minutes >= 40;
  const dur = minutes >= 60 ? `${minutes % 60 ? (minutes / 60).toFixed(1) : minutes / 60} h` : `${minutes} min`;
  switch (slot.state) {
    case "paid":
      return (
        <div className={`${box} bg-sold text-[#3d2c00] shadow-sm ${flash ? "sold-flash" : ""}`} style={pos}>
          <div className="truncate text-[13px] font-semibold">{slot.sold_to?.split(" ")[0]}</div>
          {h >= 34 && <div className="tnum truncate text-[11.5px] font-medium opacity-80">{slot.sold_price ? rupees(slot.sold_price) : ""} paid</div>}
        </div>
      );
    case "held":
      return <div className={`${box} hatch text-[11px] text-muted`} style={pos}>{big && "Kept for walk-ins"}</div>;
    case "offered":
    case "released":
      return (
        <div className={`${box} border border-dashed border-accent/60 bg-accent-soft/70 text-[11px] font-medium text-accent`} style={pos}>
          {big && "Offered"}
        </div>
      );
    default:
      return (
        <div className={`${box} border border-dashed border-line-2 bg-surface text-[11px] text-muted`} style={pos}>
          {big && <>Empty · {dur}</>}
        </div>
      );
  }
}

function useJustSold(slots: Slot[]) {
  const prev = useRef<Map<string, string> | null>(null);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  useEffect(() => {
    const before = prev.current;
    const fresh = before ? slots.filter((s) => s.state === "paid" && before.get(s.id) !== "paid").map((s) => s.id) : [];
    prev.current = new Map(slots.map((s) => [s.id, s.state]));
    if (fresh.length) {
      setFlashing(new Set(fresh));
      const t = setTimeout(() => setFlashing(new Set()), 1500);
      return () => clearTimeout(t);
    }
  }, [slots]);
  return flashing;
}

export function CalendarLegend() {
  const sw = (cls: string) => <span className={`inline-block h-3 w-4 rounded-[3px] ${cls}`} />;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
      <span className="flex items-center gap-1.5">{sw("bg-[#eef0f3]")}Booked</span>
      <span className="flex items-center gap-1.5">{sw("border border-dashed border-line-2 bg-surface")}Empty</span>
      <span className="flex items-center gap-1.5">{sw("hatch")}Kept for walk-ins</span>
      <span className="flex items-center gap-1.5">{sw("border border-dashed border-accent/60 bg-accent-soft")}Offered</span>
      <span className="flex items-center gap-1.5">{sw("bg-sold")}Sold by the agent</span>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardData } from "@/lib/useBoardData";
import type { Booking, Slot } from "@/lib/types";
import { formatClock, hhmmToMinutes, istMinutes, rupees } from "@/lib/time";

const HOUR_LABELS = ["10 am", "11", "12 pm", "1", "2", "3", "4", "5", "6", "7", "8 pm"];

/**
 * The visual anchor: 6 chairs across the salon's day.
 * Booked grey · free outlined · held for walk-ins dashed · offered pulsing · sold gold.
 */
export function ChairBoard({ data }: { data: BoardData }) {
  const { merchant, services, demo, bookings, slots } = data;
  const open = hhmmToMinutes(merchant.opens_at);
  const close = hhmmToMinutes(merchant.closes_at);
  const span = close - open;
  const pct = (min: number) => `${((min - open) / span) * 100}%`;
  const width = (a: number, b: number) => `${((b - a) / span) * 100}%`;
  const now = istMinutes(demo.clock_at);
  const serviceName = Object.fromEntries(services.map((s) => [s.id, s.name]));

  // Splitting a block into offers creates children; draw the children, not the parent.
  const parents = new Set(slots.map((s) => s.parent_slot_id).filter(Boolean));
  const visibleSlots = slots.filter((s) => !parents.has(s.id) && s.state !== "cancelled");
  // Sold time is drawn from slots; agent and front-desk bookings would duplicate it.
  const visibleBookings = bookings.filter((b) => b.source === "crm" || b.source === "walk_in");

  const justSold = useJustSold(slots);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
      <div className="min-w-[860px] p-4 sm:p-5">
        {/* hour axis */}
        <div className="relative ml-[112px] h-6 text-[11px] font-medium text-muted">
          {HOUR_LABELS.map((label, i) => (
            <span key={i} className={`absolute whitespace-nowrap ${i === HOUR_LABELS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${(i * 60 / span) * 100}%` }}>
              {label}
            </span>
          ))}
        </div>

        <div className="relative">
          {merchant.stylists.map((stylist, idx) => {
            const chair = idx + 1;
            return (
              <div key={chair} className="flex h-[58px] items-stretch border-t border-line first:border-t-0">
                <div className="flex w-[112px] shrink-0 flex-col justify-center pr-3">
                  <span className="text-[13px] font-semibold text-navy">Chair {chair}</span>
                  <span className="text-[11px] text-muted">{stylist}</span>
                </div>
                <div className="relative flex-1">
                  {/* hour gridlines */}
                  {HOUR_LABELS.map((_, i) => (
                    <div key={i} className="absolute inset-y-0 w-px bg-line/70" style={{ left: `${(i * 60 / span) * 100}%` }} />
                  ))}
                  {visibleBookings.filter((b) => b.chair === chair).map((b) => (
                    <BookingBlock key={b.id} booking={b} service={serviceName[b.service_id]}
                      minutes={istMinutes(b.end_at) - istMinutes(b.start_at)}
                      left={pct(istMinutes(b.start_at))} w={width(istMinutes(b.start_at), istMinutes(b.end_at))} />
                  ))}
                  {visibleSlots.filter((s) => s.chair === chair).map((s) => (
                    <SlotBlock key={s.id} slot={s} glow={justSold.has(s.id)}
                      minutes={istMinutes(s.end_at) - istMinutes(s.start_at)}
                      left={pct(istMinutes(s.start_at))} w={width(istMinutes(s.start_at), istMinutes(s.end_at))} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* time already gone today, and the clock line */}
          {now > open && (
            <div className="pointer-events-none absolute inset-y-0 left-[112px] right-0">
              <div className="absolute inset-y-0 left-0 bg-white/55" style={{ width: width(open, Math.min(now, close)) }} />
              {now < close && (
                <div className="absolute inset-y-0 w-0.5 bg-rzp" style={{ left: pct(now) }}>
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-rzp px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {formatClock(demo.clock_at)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Blocks under 40 minutes are too narrow for text on the board; the tooltip carries it.
const TEXT_MIN = 40;

const freeLabel = (minutes: number) =>
  minutes >= 60 ? `Free · ${minutes % 60 ? (minutes / 60).toFixed(1) : minutes / 60} h` : "Free";

function BookingBlock({ booking, service, minutes, left, w }:
  { booking: Booking; service: string; minutes: number; left: string; w: string }) {
  const name = booking.source === "walk_in"
    ? "Walk-in"
    : (booking.customers?.name ?? booking.guest_name ?? "Booked").split(" ")[0];
  return (
    <div className="absolute inset-y-1.5 overflow-hidden rounded-md bg-booked px-1.5 py-1" style={{ left, width: w }}
      title={`${name} · ${service}`}>
      {minutes >= TEXT_MIN && (
        <>
          <div className="truncate text-[11px] font-medium leading-tight text-ink/80">{name}</div>
          <div className="truncate text-[10px] leading-tight text-ink/50">{service}</div>
        </>
      )}
    </div>
  );
}

function SlotBlock({ slot, glow, minutes, left, w }:
  { slot: Slot; glow: boolean; minutes: number; left: string; w: string }) {
  const base = "absolute inset-y-1.5 overflow-hidden rounded-md px-1.5 py-1 transition-colors duration-700";
  switch (slot.state) {
    case "paid":
      return (
        <div className={`${base} bg-gold text-navy shadow-sm ${glow ? "sold-glow" : ""}`} style={{ left, width: w }}>
          <div className="truncate text-[11px] font-semibold leading-tight">Paid · {slot.sold_to?.split(" ")[0]}</div>
          <div className="truncate text-[10px] font-medium leading-tight">{slot.sold_price ? rupees(slot.sold_price) : ""}</div>
        </div>
      );
    case "held":
      return (
        <div className={`${base} held-hatch border border-dashed border-muted/70`} style={{ left, width: w }}>
          <div className="truncate text-[10px] font-medium leading-tight text-muted">Held for walk-ins</div>
        </div>
      );
    case "offered":
      return (
        <div className={`${base} border-[1.5px] border-rzp bg-rzp/5`} style={{ left, width: w }}>
          <div className="flex items-center gap-1 truncate text-[10px] font-semibold leading-tight text-rzp">
            <span className="offered-pulse inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rzp" />
            Offered
          </div>
        </div>
      );
    case "released":
      return (
        <div className={`${base} border-[1.5px] border-rzp/60 bg-white`} style={{ left, width: w }}>
          <div className="truncate text-[10px] font-medium leading-tight text-rzp/80">Released</div>
        </div>
      );
    default:
      return (
        <div className={`${base} border-[1.5px] border-muted/40 bg-white`} style={{ left, width: w }}>
          <div className="truncate text-[10px] leading-tight text-muted/80">{freeLabel(minutes)}</div>
        </div>
      );
  }
}

/** Slots that turned paid since the last render, so they can glow once. */
function useJustSold(slots: Slot[]) {
  const prev = useRef<Map<string, string> | null>(null);
  const [glowing, setGlowing] = useState<Set<string>>(new Set());
  useEffect(() => {
    const before = prev.current;
    const fresh = before
      ? slots.filter((s) => s.state === "paid" && before.get(s.id) !== "paid").map((s) => s.id)
      : [];
    prev.current = new Map(slots.map((s) => [s.id, s.state]));
    if (fresh.length) {
      setGlowing(new Set(fresh));
      const t = setTimeout(() => setGlowing(new Set()), 1400);
      return () => clearTimeout(t);
    }
  }, [slots]);
  return glowing;
}

export function BoardLegend() {
  const item = (cls: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-5 rounded-sm ${cls}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted">
      {item("bg-booked", "Booked")}
      {item("border-[1.5px] border-muted/40 bg-white", "Free")}
      {item("held-hatch border border-dashed border-muted/70", "Held for walk-ins")}
      {item("border-[1.5px] border-rzp bg-rzp/5", "Offered")}
      {item("bg-gold", "Sold by the agent")}
    </div>
  );
}

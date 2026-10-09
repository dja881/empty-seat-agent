"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardData } from "@/lib/useBoardData";
import type { Booking, Slot } from "@/lib/types";
import { hhmmToMinutes, istMinutes, rupees } from "@/lib/time";

// Service colours, the way salon calendars colour appointments by service.
const SERVICE_STYLE: Record<string, { bg: string; bar: string; ink: string }> = {
  svc_haircut: { bg: "#eaf1ff", bar: "#4f86f7", ink: "#1b3a78" },
  svc_spa: { bg: "#f2edff", bar: "#8b6cf0", ink: "#40287f" },
  svc_beard: { bg: "#e7f6ef", bar: "#2ea472", ink: "#145c3d" },
  svc_colour: { bg: "#fff0e8", bar: "#ef7b4b", ink: "#7a3315" },
};

const AVATAR_TINTS = ["#fde2e4", "#dbeafe", "#e0e7ff", "#dcfce7", "#fef3c7", "#fce7f3"];

const fmt = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  return m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`;
};

/**
 * Day view: one column per stylist, time running down, like Fresha or Square Appointments.
 * Appointments in service colours; open time outlined; agent-sold time in amber.
 */
export function Calendar({ data, pxPerMin = 1 }: { data: BoardData; pxPerMin?: number }) {
  const { merchant, services, demo, bookings, slots } = data;
  const open = hhmmToMinutes(merchant.opens_at);
  const close = hhmmToMinutes(merchant.closes_at);
  const height = (close - open) * pxPerMin;
  const y = (min: number) => (min - open) * pxPerMin;
  const now = istMinutes(demo.clock_at);
  const serviceName = Object.fromEntries(services.map((s) => [s.id, s.name]));

  const parents = new Set(slots.map((s) => s.parent_slot_id).filter(Boolean));
  const visibleSlots = slots.filter((s) => !parents.has(s.id) && s.state !== "cancelled");
  const visibleBookings = bookings.filter((b) => b.source === "crm" || b.source === "walk_in");
  const flashing = useJustSold(slots);

  const hours: number[] = [];
  for (let m = open; m <= close; m += 60) hours.push(m);

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className="min-w-[720px]">
        {/* stylist header */}
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="w-14 shrink-0" />
          {merchant.stylists.map((name, i) => (
            <div key={name} className="flex min-w-0 flex-1 items-center gap-2 border-l border-line px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-ink-2"
                style={{ background: AVATAR_TINTS[i % AVATAR_TINTS.length] }}>
                {name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{name}</span>
                <span className="block text-[11px] text-muted">Chair {i + 1}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex" style={{ height }}>
          {/* time gutter */}
          <div className="relative w-14 shrink-0">
            {hours.map((m) => (
              <span key={m} className="tnum absolute right-2 -translate-y-1/2 text-[11px] text-faint" style={{ top: y(m) }}>
                {m === close ? "" : `${fmt(m)}${m < 720 ? " am" : " pm"}`.replace("12 am", "12 pm")}
              </span>
            ))}
          </div>

          {merchant.stylists.map((name, idx) => {
            const chair = idx + 1;
            return (
              <div key={name} className="relative min-w-0 flex-1 border-l border-line">
                {hours.slice(0, -1).map((m) => (
                  <div key={m} className="absolute inset-x-0 border-t border-line" style={{ top: y(m) }}>
                    <div className="border-t border-dashed border-line/70" style={{ marginTop: 30 * pxPerMin - 1 }} />
                  </div>
                ))}
                {visibleBookings.filter((b) => b.chair === chair).map((b) => (
                  <Appointment key={b.id} booking={b} service={serviceName[b.service_id]}
                    top={y(istMinutes(b.start_at))} h={(istMinutes(b.end_at) - istMinutes(b.start_at)) * pxPerMin}
                    start={istMinutes(b.start_at)} end={istMinutes(b.end_at)} />
                ))}
                {visibleSlots.filter((s) => s.chair === chair).map((s) => (
                  <OpenTime key={s.id} slot={s} flash={flashing.has(s.id)}
                    top={y(istMinutes(s.start_at))} h={(istMinutes(s.end_at) - istMinutes(s.start_at)) * pxPerMin}
                    minutes={istMinutes(s.end_at) - istMinutes(s.start_at)} start={istMinutes(s.start_at)} />
                ))}
              </div>
            );
          })}

          {/* elapsed time and the current-time line */}
          {now > open && (
            <div className="pointer-events-none absolute inset-y-0 left-14 right-0">
              <div className="absolute inset-x-0 top-0 bg-white/50" style={{ height: y(Math.min(now, close)) }} />
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

function Appointment({ booking, service, top, h, start, end }: {
  booking: Booking; service: string; top: number; h: number; start: number; end: number;
}) {
  const style = SERVICE_STYLE[booking.service_id] ?? SERVICE_STYLE.svc_haircut;
  const name = booking.source === "walk_in" ? "Walk-in" : booking.customers?.name ?? booking.guest_name ?? "Booked";
  const compact = h < 34;
  return (
    <div className="absolute inset-x-1 overflow-hidden rounded-[5px] border-l-[3px] px-1.5"
      style={{ top: top + 1, height: h - 2, background: style.bg, borderColor: style.bar, color: style.ink }}
      title={`${fmt(start)}–${fmt(end)} · ${name} · ${service}`}>
      {compact ? (
        <div className="truncate pt-px text-[10.5px] leading-[16px]"><span className="font-semibold">{name.split(" ")[0]}</span> · {service}</div>
      ) : (
        <div className="pt-1 leading-tight">
          <div className="tnum text-[10.5px] opacity-70">{fmt(start)}–{fmt(end)}</div>
          <div className="truncate text-[12px] font-semibold">{name}</div>
          {h >= 52 && <div className="truncate text-[11px] opacity-80">{service}</div>}
        </div>
      )}
    </div>
  );
}

function OpenTime({ slot, flash, top, h, minutes, start }: {
  slot: Slot; flash: boolean; top: number; h: number; minutes: number; start: number;
}) {
  const box = "absolute inset-x-1 overflow-hidden rounded-[5px] px-1.5 pt-1 text-[11px] leading-tight transition-colors duration-500";
  const pos = { top: top + 1, height: h - 2 };
  const dur = minutes >= 60 ? `${minutes % 60 ? (minutes / 60).toFixed(1) : minutes / 60} h` : `${minutes} min`;
  switch (slot.state) {
    case "paid":
      return (
        <div className={`${box} border-l-[3px] border-sold bg-sold-soft text-sold-ink ${flash ? "sold-flash" : ""}`} style={pos}>
          <div className="tnum text-[10.5px] opacity-70">{fmt(start)} · Paid</div>
          <div className="truncate text-[12px] font-semibold">{slot.sold_to}</div>
          {h >= 52 && <div className="tnum truncate">{slot.sold_price ? rupees(slot.sold_price) : ""} · via agent</div>}
        </div>
      );
    case "held":
      return (
        <div className={`${box} hatch border border-dashed border-line-2 text-muted`} style={pos}>
          Held for walk-ins
        </div>
      );
    case "offered":
      return (
        <div className={`${box} border border-dashed border-accent/70 bg-accent-soft/60 text-accent`} style={pos}>
          <span className="font-medium">Offered</span> · {dur}
        </div>
      );
    case "released":
      return (
        <div className={`${box} border border-accent/40 bg-surface text-accent/80`} style={pos}>
          Released · {dur}
        </div>
      );
    default:
      return (
        <div className={`${box} border border-dashed border-line-2 bg-surface text-faint`} style={pos}>
          Open · {dur}
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
  const sw = (style: React.CSSProperties, cls = "") => <span className={`inline-block h-3 w-4 rounded-[3px] ${cls}`} style={style} />;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
      {Object.entries({ Haircut: "svc_haircut", "Hair spa": "svc_spa", "Beard trim": "svc_beard", Colour: "svc_colour" }).map(([label, id]) => (
        <span key={id} className="flex items-center gap-1.5">
          {sw({ background: SERVICE_STYLE[id].bg, borderLeft: `3px solid ${SERVICE_STYLE[id].bar}` })}{label}
        </span>
      ))}
      <span className="mx-1 h-3 w-px bg-line-2" />
      <span className="flex items-center gap-1.5">{sw({}, "border border-dashed border-line-2 bg-surface")}Open</span>
      <span className="flex items-center gap-1.5">{sw({}, "hatch border border-dashed border-line-2")}Held for walk-ins</span>
      <span className="flex items-center gap-1.5">{sw({}, "border border-dashed border-accent/70 bg-accent-soft")}Offered</span>
      <span className="flex items-center gap-1.5">{sw({}, "border-l-[3px] border-sold bg-sold-soft")}Sold by agent</span>
    </div>
  );
}

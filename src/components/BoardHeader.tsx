"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardData } from "@/lib/useBoardData";
import { emptySlotCount, soldRevenue } from "@/lib/slots";
import { formatClockFull, formatDay, rupees } from "@/lib/time";

/** Salon name, demo clock and the "32 empty slots · ₹0" counter. */
export function BoardHeader({ data }: { data: BoardData }) {
  const empty = emptySlotCount(data.slots);
  const revenue = useCountUp(soldRevenue(data.slots));
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {data.merchant.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.merchant.logo_url} alt="" className="h-11 w-11 rounded-xl" />
        )}
        <div>
          <h1 className="text-xl font-semibold text-navy">{data.merchant.name}</h1>
          <p className="text-[13px] text-muted">{formatDay(data.demo.clock_at)} · Madhapur, Hyderabad</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-line bg-white px-4 py-2 text-right">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Now</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-navy">{formatClockFull(data.demo.clock_at)}</div>
        </div>
        <div className="rounded-xl bg-navy px-4 py-2 text-right text-white">
          <div className="text-[11px] font-medium uppercase tracking-wide text-white/60">Today</div>
          <div className="text-lg font-semibold tabular-nums">
            {empty} empty slots · <span className="text-gold">{rupees(revenue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      const v = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3)));
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

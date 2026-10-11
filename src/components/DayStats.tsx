"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardData } from "@/lib/useBoardData";
import { emptySlotCount, soldRevenue } from "@/lib/slots";
import { formatClockFull, formatDay, rupees } from "@/lib/time";

/**
 * Header stats: demo clock, open slots, and the day's estimated extra revenue. That is the
 * same figure, by the same name, as the headline of the day report (booking revenue minus what
 * would likely have come in anyway and the agent's fee), refreshed whenever a slot is sold.
 */
export function DayStats({ data }: { data: BoardData }) {
  const sold = soldRevenue(data.slots);
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    let live = true;
    fetch("/api/report").then((r) => r.json()).then((r) => { if (live) setExtra(r?.totals?.extra ?? 0); }).catch(() => {});
    return () => { live = false; };
  }, [sold]);
  const revenue = useCountUp(extra);
  const stat = (label: string, value: React.ReactNode, cls = "text-ink") => (
    <div className="px-4 text-right first:pl-0">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`tnum text-[15px] font-semibold leading-tight ${cls}`}>{value}</div>
    </div>
  );
  return (
    <div className="flex items-center divide-x divide-line">
      {stat(formatDay(data.demo.clock_at).replace(/^\w+, /, ""), formatClockFull(data.demo.clock_at))}
      {stat("Open slots", emptySlotCount(data.slots))}
      {stat("Estimated extra revenue", rupees(revenue), "text-success")}
    </div>
  );
}

export function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setValue(Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

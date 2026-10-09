"use client";

import type { ReactNode } from "react";
import { formatClockFull } from "@/lib/time";

/**
 * On a desktop the customer's screens sit in a phone-sized frame; on an actual phone they
 * fill the screen. The status bar shows the demo clock so the story's time is consistent.
 */
export function PhoneFrame({ clock, children, dark = false }: { clock?: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#e9ebee] sm:p-6">
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-[844px] sm:w-[390px] sm:rounded-[44px] sm:border-[10px] sm:border-[#1c1c1e] sm:shadow-2xl">
        <div className={`hidden h-11 shrink-0 items-center justify-between px-7 text-[14px] font-semibold sm:flex ${dark ? "bg-[#075e54] text-white" : "bg-white text-black"}`}>
          <span className="tnum">{clock ? formatClockFull(clock).replace(/ (am|pm)/, "") : "9:41"}</span>
          <span className="absolute left-1/2 top-2 h-[26px] w-[110px] -translate-x-1/2 rounded-full bg-[#1c1c1e]" />
          <span className="flex items-center gap-1.5">
            <Bars /> <span className="text-[12px]">5G</span> <Battery />
          </span>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

const Bars = () => (
  <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
);
const Battery = () => (
  <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor" /><rect x="23" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" /></svg>
);

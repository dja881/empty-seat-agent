"use client";

import { useState } from "react";
import Link from "next/link";
import { StrandLogo } from "@/components/StrandLogo";

// The seeded Tuesday opens with 32 empty slots (about 27 chair-hours). At roughly ₹550 a
// chair-hour over 21 weekdays, that is about ₹3 lakh a month of unsold time.
const EMPTY_SLOTS = 32;

const Tick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B8A5B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** Opening screen: the salon, the problem in one number, and one button into the day. */
export default function Opening() {
  const [starting, setStarting] = useState(false);
  async function start() {
    setStarting(true);
    await fetch("/api/demo/reset", { method: "POST" });
    window.location.href = "/merchant";
  }
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#F5F7FB] px-6 pb-8 pt-10 text-[#0B1B3F]">
      <div className="flex w-full max-w-[980px] flex-1 flex-col items-center justify-center gap-7 text-center">
        <div className="flex flex-col items-center gap-3.5">
          <StrandLogo />
          <div className="tnum text-[14px] text-[#5B6B85]">6 chairs · 10 am to 8 pm</div>
        </div>

        <div className="flex flex-col items-center gap-2.5 py-2">
          <h1 className="tnum text-balance font-bold leading-[1.05] tracking-[-.01em] text-[#0B1B3F]" style={{ fontSize: "clamp(34px,6vw,56px)" }}>
            {EMPTY_SLOTS} empty slots today
          </h1>
          <p className="tnum text-[16px] text-[#4A5A73]">About ₹3 lakh a month goes unsold on weekday afternoons</p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-7 gap-y-2.5 rounded-full border border-[#E3E8F0] bg-white px-5 py-3">
          {["Razorpay payments", "Booking calendar", "WhatsApp Business (salon number)"].map((t) => (
            <span key={t} className="inline-flex items-center gap-2 text-[13.5px] text-[#33415C]"><Tick />{t}</span>
          ))}
        </div>

        <button onClick={start} disabled={starting}
          className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-lg bg-[#1566F1] px-7 text-[16px] font-semibold text-white hover:bg-[#0F52C6] disabled:opacity-70">
          {starting ? "Opening the salon…" : "Start Tuesday, 9:00 am"}
          {!starting && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>

      <footer className="mt-8 flex flex-wrap justify-center gap-x-2 gap-y-1.5 text-center text-[13px] text-[#5B6B85]">
        <span>Demo merchant · synthetic data · Razorpay test mode · Suggested path: start the day, approve the plan, pay as Riya ·</span>
        <Link href="/merchant/settings" className="text-[#1566F1] hover:text-[#0F52C6]">Agent settings</Link>
        <span>·</span>
        <Link href="/merchant/front-desk" className="text-[#1566F1] hover:text-[#0F52C6]">Front desk</Link>
      </footer>
    </main>
  );
}

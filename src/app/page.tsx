"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { StrandLogo } from "@/components/StrandLogo";
import { BRAND } from "@/lib/brand";

// The seeded Tuesday opens with 32 empty slots (about 27 chair-hours). At roughly ₹550 a
// chair-hour over 21 weekdays, that is about ₹3 lakh a month of unsold time.
const EMPTY_SLOTS = 32;

/** Opening screen: the salon, the problem in one number, and one button into the day. */
export default function Opening() {
  const [starting, setStarting] = useState(false);
  async function start() {
    setStarting(true);
    await fetch("/api/demo/reset", { method: "POST" });
    window.location.href = "/merchant";
  }
  return (
    <main className="flex min-h-screen flex-col items-center px-4 text-white" style={{ background: BRAND.ink }}>
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <StrandLogo width={400} />
        <p className="mt-9 text-[14px] text-[#9aa4b5]">6 chairs · 10 am to 8 pm</p>
        <h1 className="tnum mt-9 text-[40px] font-bold leading-none tracking-tight sm:text-[56px]">{EMPTY_SLOTS} empty slots today</h1>
        <p className="mt-3 text-[16px] text-[#aab3c2]">About ₹3 lakh a month goes unsold on weekday afternoons</p>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 rounded-full border border-white/15 px-6 py-2.5 text-[14px] text-[#d7dce5]">
          {["Razorpay payments", "Booking calendar", "WhatsApp Business (salon number)"].map((t) => (
            <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#34d399]" strokeWidth={2.5} />{t}</li>
          ))}
        </ul>

        <button onClick={start} disabled={starting}
          className="mt-8 inline-flex items-center gap-2.5 rounded-md bg-[#1f6bff] px-7 py-3.5 text-[16px] font-semibold text-white hover:bg-[#1a5ce0] disabled:opacity-70">
          {starting ? "Opening the salon…" : "Start Tuesday, 9:00 am"} {!starting && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>

      <footer className="pb-8 text-center text-[13px] leading-relaxed text-[#8b95a7]">
        Demo merchant · synthetic data · Razorpay test mode · Suggested path: start the day, approve the plan, pay as Riya ·{" "}
        <Link href="/merchant/settings" className="text-[#c5ccd8] underline underline-offset-2">Agent settings</Link> ·{" "}
        <Link href="/merchant/front-desk" className="text-[#c5ccd8] underline underline-offset-2">Front desk</Link>
      </footer>
    </main>
  );
}

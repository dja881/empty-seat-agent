"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const PATH = [
  ["Morning plan", "The agent briefs Priya by voice; she changes the discount and approves.", "/merchant"],
  ["Customers", "Who gets the first offers, at what time and price, and why.", "/merchant"],
  ["Live sale", "Reply as Riya on her phone, pay in Razorpay test mode, watch the chair turn gold.", "/phone/riya"],
  ["Daily report", "Revenue recovered, bank-funded share, what the agent learned.", "/merchant/summary"],
  ["Agent to agent", "A customer's AI assistant books tomorrow's slot within both sides' limits.", "/agents"],
];

/** Landing: what this is, who it's for, the suggested path, and Reset. */
export default function Landing() {
  const [resetting, setResetting] = useState(false);
  async function reset() {
    setResetting(true);
    await fetch("/api/demo/reset", { method: "POST" });
    setResetting(false);
  }
  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/glow-logo.svg" alt="" className="h-7 w-7 rounded-md" />
            <span className="text-[14px] font-semibold text-ink">Empty Seat Agent</span>
          </div>
          <span className="rounded bg-warn-soft px-2 py-0.5 text-[12px] font-medium text-warn">Prototype · synthetic data · Razorpay test mode</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[13px] font-medium text-accent">A growth agent for appointment businesses</p>
            <h1 className="mt-2 text-[34px] font-semibold leading-tight tracking-tight text-ink">Sells a salon&apos;s empty chairs before the day ends.</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
              Every morning it agrees a plan with the owner, using local footfall from Razorpay&apos;s network to decide which time to hold for walk-ins and which to sell. It offers the rest to the salon&apos;s own customers on WhatsApp, in the receptionist&apos;s name, negotiates within the owner&apos;s limits, and locks each slot the moment the customer pays through Razorpay.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/merchant" className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1849d6]">
                Start the demo <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={reset} disabled={resetting} className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[14px] font-medium text-ink-2 hover:bg-background disabled:opacity-60">
                {resetting ? "Resetting…" : "Reset demo to 9:00 am"}
              </button>
            </div>
            <p className="mt-3 text-[12.5px] text-muted">Best in Chrome on a laptop, with the customer&apos;s phone (/phone/riya) open on your own phone.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 self-start">
            {[["Open slots at 9 am", "32"], ["Held for walk-ins", "10"], ["Sold by 8 pm", "7"], ["Recovered", "₹3,160"]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-surface px-4 py-3">
                <div className="text-[12px] text-muted">{k}</div>
                <div className="tnum text-[22px] font-semibold text-ink">{v}</div>
              </div>
            ))}
            <p className="col-span-2 text-[12px] text-muted">Glow Salon, Madhapur, Hyderabad: a 6-chair salon on a slow Tuesday. Base case of the demo day.</p>
          </div>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Suggested path · about 3 minutes</h2>
            <ol className="mt-3 space-y-2">
              {PATH.map(([title, text, href], i) => (
                <li key={title}>
                  <Link href={href} className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent/40">
                    <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-[12px] font-medium text-ink-2">{i + 1}</span>
                    <span><span className="block text-[14px] font-medium text-ink">{title}</span><span className="block text-[13px] text-muted">{text}</span></span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Also in the prototype</h2>
            <div className="mt-3 space-y-2">
              <Link href="/merchant/settings" className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent/40">
                <span className="block text-[14px] font-medium text-ink">Agent limits</span><span className="block text-[13px] text-muted">Floors, max discount, VIPs, quiet hours, approval mode.</span>
              </Link>
              <Link href="/merchant/front-desk" className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent/40">
                <span className="block text-[14px] font-medium text-ink">Front desk</span><span className="block text-[13px] text-muted">Sneha sees every offer, gets call requests, and books by phone.</span>
              </Link>
              <div className="rounded-xl border border-dashed border-line-2 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
                Demo mode simulates other customers when you move the clock (menu at top right of the dashboard). Live mode turns that off: you play the customer and pay in Razorpay test mode. Glow Salon, its 60 customers and the area&apos;s footfall are synthetic.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FastForward, RotateCcw } from "lucide-react";
import type { DemoState } from "@/lib/types";

type Step = { to: string; simulate?: ("sale" | "walk_in" | "call_me")[] };

// The demo day in beats. Each beat moves the clock; in demo mode simulated customers act.
const BEATS: { id: string; label: string; hint: string; steps: Step[]; after?: string }[] = [
  {
    id: "midday", label: "Jump to 1:30 pm", hint: "Wave 1 customers pay; footfall check",
    steps: [{ to: "11:50", simulate: ["sale"] }, { to: "12:20", simulate: ["sale"] }, { to: "12:50", simulate: ["sale"] }, { to: "13:30" }],
  },
  {
    id: "afternoon", label: "Fast-forward 2 to 6 pm", hint: "Released slot sells, walk-ins arrive",
    steps: [
      { to: "14:00", simulate: ["sale", "sale"] }, { to: "15:00", simulate: ["walk_in"] },
      { to: "15:30", simulate: ["call_me", "walk_in"] }, { to: "16:00", simulate: ["walk_in", "walk_in"] },
      { to: "17:00", simulate: ["walk_in", "walk_in"] }, { to: "18:00" },
    ],
  },
  { id: "close", label: "Close the day at 8 pm", hint: "Daily report", steps: [{ to: "20:00" }], after: "/merchant/summary" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Demo controls: move the story clock, switch live/demo, the scripted switch, reset. */
export function DemoBar({ demo, onReset }: { demo: DemoState; onReset?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function post(url: string, body: unknown) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  async function runBeat(beat: (typeof BEATS)[number]) {
    setOpen(false);
    setBusy(beat.label);
    for (const step of beat.steps) {
      await post("/api/demo/clock", { to: step.to, simulate: demo.mode === "demo" ? step.simulate ?? [] : [] });
      await sleep(beat.id === "afternoon" ? 900 : 1100);
    }
    setBusy(null);
    if (beat.after) window.location.href = beat.after;
  }

  async function reset() {
    setOpen(false);
    setBusy("Resetting");
    await post("/api/demo/reset", {});
    setBusy(null);
    onReset?.();
    window.location.href = "/merchant";
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-background">
        <span className={`h-2 w-2 rounded-full ${demo.mode === "demo" ? "bg-warn" : "bg-success"}`} />
        {busy ?? (demo.mode === "demo" ? "Demo" : "Live")}
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[300px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <div className="text-[12px] font-medium text-muted">Mode</div>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
              {(["demo", "live"] as const).map((m) => (
                <button key={m} onClick={() => post("/api/demo/state", { mode: m })}
                  className={`rounded-md py-1.5 text-[12.5px] font-medium ${demo.mode === m ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
                  {m === "demo" ? "Demo" : "Live"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-snug text-muted">
              {demo.mode === "demo"
                ? "Simulated customers reply and pay when you move the clock. Riya's phone stays fully live."
                : "No simulated customers. You play the customer on the phone and pay in Razorpay test mode."}
            </p>
          </div>
          {BEATS.map((b) => (
            <button key={b.id} onClick={() => runBeat(b)} disabled={!!busy}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-background disabled:opacity-50">
              <FastForward className="mt-0.5 h-4 w-4 text-muted" />
              <span>
                <span className="block text-[13px] font-medium text-ink">{b.label}</span>
                <span className="block text-[12px] text-muted">{b.hint}</span>
              </span>
            </button>
          ))}
          <label className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px] text-ink-2">
            <span>
              Scripted replies
              <span className="block text-[12px] text-muted">Fallback if a live reply misbehaves</span>
            </span>
            <input type="checkbox" checked={demo.scripted} onChange={(e) => post("/api/demo/state", { scripted: e.target.checked })}
              className="h-4 w-4 accent-[#1f5eff]" />
          </label>
          <button onClick={reset} className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-danger hover:bg-background">
            <RotateCcw className="h-4 w-4" /> Reset demo to 9:00 am
          </button>
        </div>
      )}
    </div>
  );
}

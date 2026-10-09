"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, RotateCcw } from "lucide-react";
import type { DemoState } from "@/lib/types";

/** Small settings menu: live/demo mode, scripted switch, reset. The story moves with the Next button. */
export function DemoBar({ demo }: { demo: DemoState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Demo settings"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:bg-background">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[290px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
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
                ? "Other customers are simulated when you move the clock. Riya's phone stays fully live."
                : "No simulated customers. You play the customer and pay in Razorpay test mode."}
            </p>
          </div>
          <label className="flex items-center justify-between px-4 py-2.5 text-[13px] text-ink-2">
            <span>Scripted replies<span className="block text-[12px] text-muted">Safety net for recording</span></span>
            <input type="checkbox" checked={demo.scripted} onChange={(e) => post("/api/demo/state", { scripted: e.target.checked })} className="h-4 w-4 accent-[#1f5eff]" />
          </label>
          <button onClick={async () => { await post("/api/demo/reset", {}); window.location.href = "/merchant"; }}
            className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-danger hover:bg-background">
            <RotateCcw className="h-4 w-4" /> Reset demo to 9:00 am
          </button>
        </div>
      )}
    </div>
  );
}

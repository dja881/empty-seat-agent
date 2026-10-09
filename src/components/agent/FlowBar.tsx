"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export type Stage = "idle" | "plan" | "customers" | "live" | "done";
const ORDER: Stage[] = ["idle", "plan", "customers", "live", "done"];
const STEPS: { id: Exclude<Stage, "idle">; label: string; href: string }[] = [
  { id: "plan", label: "Morning plan", href: "/merchant?view=plan" },
  { id: "customers", label: "Choose customers", href: "/merchant?view=customers" },
  { id: "live", label: "Live sales", href: "/merchant?view=live" },
  { id: "done", label: "Day report", href: "/merchant/summary" },
];

/**
 * Where the day is (stage) and what you're looking at (view). Any reached step can be opened
 * again; the Next button always moves the day forward from where it really is.
 */
export function FlowBar({ stage, view, next, busy, extra }: {
  stage: Stage; view: Stage; next: { label: string; run: () => void } | null; busy: string | null; extra?: React.ReactNode;
}) {
  const at = ORDER.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
      <ol className="flex flex-wrap items-center gap-1 text-[13px]">
        {STEPS.map((s, i) => {
          const idx = ORDER.indexOf(s.id);
          const reached = at >= idx || (s.id === "done" && at >= ORDER.indexOf("live"));
          const done = at > idx;
          const looking = view === s.id || (view === "idle" && s.id === "plan");
          const body = (
            <span className={`flex items-center gap-2 rounded-md px-2 py-1 ${reached ? "hover:bg-background" : ""} ${looking ? "bg-background" : ""}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${done ? "bg-success text-white" : at === idx || (stage === "idle" && i === 0) ? "bg-accent text-white" : "bg-background text-muted"}`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={looking ? "font-semibold text-ink" : reached ? "text-ink-2" : "text-muted"}>{s.label}</span>
            </span>
          );
          return (
            <li key={s.id} className="flex items-center gap-1">
              {i > 0 && <span className="h-px w-4 bg-line-2" />}
              {reached ? <Link href={s.href}>{body}</Link> : body}
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-2">
        {extra}
        {next && (
          <button onClick={next.run} disabled={!!busy}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#1849d6] disabled:opacity-70">
            {busy ?? next.label} {!busy && <ArrowRight className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

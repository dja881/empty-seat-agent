"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square } from "lucide-react";
import type { Plan } from "@/lib/types";
import { useVoice } from "@/lib/useVoice";
import { rupees } from "@/lib/time";

interface Signals { nearby: number; salons: number; lastHour: number; merchants: number; walkIns4pm: number }

// Same rounding as the spoken briefing (nearest 5%), so the numbers on screen match what the agent says.
const pct = (r: number) => `${r < 1 ? "−" : "+"}${Math.abs(Math.round((r - 1) * 20) * 5)}%`;

/** Screen 1: the morning plan, agreed with the owner by voice or text. */
export function PlanPanel({ plan, ownerName, onApproved }: { plan: Plan | null; ownerName: string; onApproved: () => void }) {
  const [signals, setSignals] = useState<Signals | null>(null);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [started, setStarted] = useState(false);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/agent/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.signals) setSignals(json.signals);
    return json as { plan: Plan; reply?: string; briefing?: string };
  }, []);

  const send = useCallback(async (said: string) => {
    if (!said.trim()) return;
    setText("");
    setThinking(true);
    const { plan: next, reply } = await post({ op: "edit", text: said });
    setThinking(false);
    if (reply) await voice.speak(reply);
    if (next.status === "approved") onApproved();
    else if (started && voice.supported) voice.listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, onApproved, started]);

  const voice = useVoice(send);

  const proposed = useRef(false);
  useEffect(() => { if (!proposed.current) { proposed.current = true; post({ op: "propose" }); } }, [post]);

  async function startBriefing() {
    setStarted(true);
    const { briefing } = await post({ op: "propose" });
    if (briefing) await voice.speak(briefing);
    if (voice.supported) voice.listen();
  }

  async function act(op: "approve" | "skip" | "pause") {
    voice.stop();
    const { plan: next, reply } = await post({ op });
    if (reply) voice.speak(reply);
    if (next.status === "approved") onApproved();
  }

  if (!plan) return <div className="rounded-xl border border-line bg-surface p-4 text-muted">Reading today&apos;s bookings…</div>;
  const original = plan.history.find((h) => h.from === "agent")?.text.match(/up to ₹(\d+)/)?.[1];
  const edited = original && Number(original) !== plan.maxDiscount;

  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="text-[14px] font-semibold text-ink">Morning plan</div>
          <div className="text-[12px] text-muted">Voice briefing for {ownerName}</div>
        </div>
        <StatusBadge status={plan.status} />
      </div>

      {/* conversation */}
      <div className="max-h-[260px] space-y-3 overflow-y-auto px-4 py-3">
        {plan.history.map((h, i) => (
          <div key={i} className={h.from === "owner" ? "pl-8 text-right" : "pr-4"}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{h.from === "owner" ? ownerName : "Agent"}</div>
            <p className={`mt-0.5 text-[13.5px] leading-snug ${h.from === "owner" ? "text-ink" : "text-ink-2"}`}>{h.text}</p>
          </div>
        ))}
        {voice.interim && <p className="pl-8 text-right text-[13.5px] italic text-muted">{voice.interim}</p>}
        {thinking && <p className="text-[12px] text-muted">Updating the plan…</p>}
      </div>

      {plan.status === "proposed" && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          {!started ? (
            <button onClick={startBriefing} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-2 hover:bg-background">
              <Play className="h-4 w-4" /> Play briefing
            </button>
          ) : (
            <button onClick={() => (voice.listening ? voice.stop() : voice.listen())} disabled={!voice.supported}
              aria-label={voice.listening ? "Stop listening" : "Speak"}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${voice.listening ? "bg-danger text-white" : voice.speaking ? "bg-accent-soft text-accent" : "border border-line text-ink-2"} disabled:opacity-40`}>
              {voice.listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex-1">
            <input value={text} onChange={(e) => setText(e.target.value)}
              placeholder={voice.listening ? "Listening…" : "Change the plan, e.g. keep 4 pm open"}
              className="w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-accent" />
          </form>
        </div>
      )}

      {/* the plan */}
      <dl className="divide-y divide-line border-t border-line text-[13px]">
        <Row label="Slots to offer" value={<b className="tnum">{plan.releasedUnits}</b>} />
        <Row label="Held for walk-ins" value={<span className="tnum">{plan.heldUnits} · {plan.heldHours}</span>} />
        <Row label="Max discount" value={
          <span className="flex items-center gap-2">
            {edited && <span className="tnum text-faint line-through">₹{original}</span>}
            <b className="tnum">₹{plan.maxDiscount}</b>
            {edited && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">Edited</span>}
          </span>
        } />
        <Row label="First wave" value={<span className="tnum">11:30 am · 12 customers</span>} />
        <Row label="Expected recovery" value={<b className="tnum text-success">{rupees(plan.expectedRevenue)}</b>} />
      </dl>

      {signals && (
        <div className="border-t border-line px-4 py-3">
          <div className="text-[12px] font-medium text-muted">Why</div>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            <li className="flex justify-between"><span className="text-ink-2">In-store payments within 2 km</span><span className="tnum font-medium text-warn">{pct(signals.nearby)} vs normal</span></li>
            <li className="flex justify-between"><span className="text-ink-2">Similar salons nearby</span><span className="tnum font-medium text-warn">{pct(signals.salons)}, also quiet</span></li>
            <li className="flex justify-between"><span className="text-ink-2">Your usual walk-ins at 4 pm</span><span className="tnum font-medium text-ink">{signals.walkIns4pm.toFixed(1)}</span></li>
          </ul>
          <p className="mt-2 text-[11.5px] leading-snug text-faint">
            Aggregated from {signals.merchants} merchants on Razorpay near you. No single merchant&apos;s numbers are shown.
          </p>
        </div>
      )}

      {plan.status === "proposed" && (
        <div className="flex gap-2 border-t border-line p-3">
          <button onClick={() => act("approve")} className="flex-1 rounded-lg bg-accent py-2 text-[13px] font-semibold text-white hover:bg-[#1849d6]">Approve plan</button>
          <button onClick={() => act("skip")} className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-2 hover:bg-background">Skip today</button>
          <button onClick={() => act("pause")} aria-label="Pause agent" className="rounded-lg border border-line px-3 py-2 text-ink-2 hover:bg-background"><Pause className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function StatusBadge({ status }: { status: Plan["status"] }) {
  const map = {
    proposed: ["Awaiting approval", "bg-warn-soft text-warn"],
    approved: ["Running", "bg-success-soft text-success"],
    skipped: ["Skipped today", "bg-background text-muted"],
    paused: ["Paused", "bg-background text-muted"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`rounded-md px-2 py-1 text-[11.5px] font-medium ${cls}`}>{label}</span>;
}

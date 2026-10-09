"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, SendHorizontal, Square } from "lucide-react";
import type { Plan } from "@/lib/types";
import type { Line } from "@/lib/useAgentChat";
import { rupees } from "@/lib/time";
import { AgentOrb } from "./AgentOrb";

type Chat = {
  lines: Line[]; send: (t: string) => void; approve: () => void; interim: string;
  state: "idle" | "speaking" | "listening" | "thinking";
  voice: { listen: () => void; stop: () => void; supported: boolean; listening: boolean };
};

/** Morning: the conversation with the agent and the plan it builds, line by line. */
export function AgentPanel({ chat, plan, ownerName, asleep }: { chat: Chat; plan: Plan | null; ownerName: string; asleep: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [chat.lines, chat.interim]);
  const briefed = chat.lines.some((l) => l.from === "agent" && (l.reveal ?? 1) >= 1);
  const original = plan?.history.find((h) => h.from === "agent")?.text.match(/up to ₹(\d+)/)?.[1];
  const edited = original && plan && Number(original) !== plan.maxDiscount;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <AgentOrb state={asleep ? "asleep" : chat.state} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink">Empty Seat Agent</div>
          <div className="text-[12px] text-muted">
            {asleep ? "Asleep · tap Start my day" : chat.state === "listening" ? "Listening…" : chat.state === "speaking" ? "Speaking" : chat.state === "thinking" ? "Thinking…" : plan?.status === "approved" ? "Running today" : "Waiting for you"}
          </div>
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {asleep && <p className="text-[13.5px] leading-relaxed text-muted">I&apos;ll read today&apos;s bookings and the street around the salon, and suggest which empty chairs to sell.</p>}
        {chat.lines.map((l, i) => <Bubble key={i} line={l} owner={ownerName} />)}
        {chat.interim && <p className="pl-10 text-right text-[14px] italic text-muted">{chat.interim}</p>}

        {plan && briefed && plan.status !== "approved" && (
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            {[
              ["Offer", <b key="o" className="tnum">{plan.releasedUnits} empty slots</b>],
              ["Keep for walk-ins", <span key="k" className="tnum">{plan.heldUnits} · {plan.heldHours}</span>],
              ["Max discount", <span key="d" className="flex items-center gap-2">{edited && <span className="tnum text-faint line-through">₹{original}</span>}<b className="tnum">₹{plan.maxDiscount}</b></span>],
              ["First offers", <span key="f" className="tnum">11:30 am · 12 customers</span>],
              ["Expected today", <b key="e" className="tnum text-success">{rupees(plan.expectedRevenue)}</b>],
            ].map(([k, v], i) => (
              <div key={String(k)} className="flex items-center justify-between border-t border-line px-3 py-2 text-[13px] first:border-t-0"
                style={{ animation: `fade-up .4s ease ${i * 0.12}s both` }}>
                <span className="text-muted">{k}</span><span className="text-ink">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {plan && plan.status === "proposed" && briefed && (
        <div className="px-4 pb-2">
          <button onClick={chat.approve} className="w-full rounded-lg bg-accent py-2.5 text-[14px] font-semibold text-white hover:bg-[#1849d6]">Approve plan</button>
        </div>
      )}
      {!asleep && <AskBar chat={chat} placeholder={plan?.status === "approved" ? "Ask your agent anything" : "Say or type a change, e.g. make it ₹100"} />}
      <style>{`@keyframes fade-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function Bubble({ line, owner }: { line: Line; owner: string }) {
  if (line.from === "owner") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="mb-0.5 text-right text-[11px] text-faint">{owner}</div>
          <p className="rounded-lg rounded-tr-none bg-background px-3 py-2 text-[14px] leading-snug text-ink">{line.text}</p>
        </div>
      </div>
    );
  }
  const words = line.text.split(" ");
  const shown = Math.ceil(words.length * Math.min(1, (line.reveal ?? 1) * 1.08));
  return (
    <div className="max-w-[92%]">
      <div className="mb-0.5 text-[11px] text-faint">Agent</div>
      <p className="text-[14.5px] leading-relaxed text-ink">
        {words.slice(0, shown).join(" ")}
        {shown < words.length && <span className="text-faint"> {words.slice(shown).join(" ")}</span>}
      </p>
    </div>
  );
}

/** Talk or type to the agent, all day. */
export function AskBar({ chat, placeholder, compact = false }: { chat: Chat; placeholder: string; compact?: boolean }) {
  const [text, setText] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); chat.send(text); setText(""); }}
      className={`flex items-center gap-2 ${compact ? "" : "border-t border-line px-3 py-3"}`}>
      <button type="button" onClick={() => (chat.voice.listening ? chat.voice.stop() : chat.voice.listen())} disabled={!chat.voice.supported}
        aria-label={chat.voice.listening ? "Stop listening" : "Speak to the agent"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${chat.voice.listening ? "bg-danger text-white" : "border border-line text-ink-2 hover:bg-background"} disabled:opacity-40`}>
        {chat.voice.listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
      </button>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={chat.voice.listening ? "Listening…" : placeholder}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
      <button type="submit" disabled={!text.trim()} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-30">
        <SendHorizontal className="h-4 w-4" />
      </button>
    </form>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Sun } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Calendar, CalendarLegend } from "@/components/Calendar";
import { DayStats } from "@/components/DayStats";
import { DemoBar } from "@/components/agent/DemoBar";
import { AgentPanel, AskBar } from "@/components/agent/AgentPanel";
import { AgentOrb } from "@/components/agent/AgentOrb";
import { WaveView } from "@/components/agent/WaveView";
import { ActivityFeed } from "@/components/agent/ActivityFeed";
import { LivePhone } from "@/components/agent/LivePhone";
import { useBoardData } from "@/lib/useBoardData";
import { useEvents } from "@/lib/useEvents";
import { useAgentChat } from "@/lib/useAgentChat";
import { chime } from "@/lib/chime";
import { emptySlotCount } from "@/lib/slots";
import { istMinutes, rupees } from "@/lib/time";
import type { AgentEvent, Plan } from "@/lib/types";

type Stage = "idle" | "plan" | "customers" | "live" | "done";
type Step = { to: string; simulate?: ("sale" | "walk_in" | "call_me")[] };

const MIDDAY: Step[] = [{ to: "11:50", simulate: ["sale"] }, { to: "12:20", simulate: ["sale"] }, { to: "12:50", simulate: ["sale"] }, { to: "13:30" }];
const AFTERNOON: Step[] = [
  { to: "14:00", simulate: ["sale", "sale"] }, { to: "15:00", simulate: ["walk_in"] }, { to: "15:30", simulate: ["call_me", "walk_in"] },
  { to: "16:00", simulate: ["walk_in", "walk_in"] }, { to: "17:00", simulate: ["walk_in", "walk_in"] }, { to: "18:00" },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One guided page: morning plan → customers → live → day report, with one Next button. */
export default function MerchantPage() {
  const { data, error, reload } = useBoardData();
  const events = useEvents();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (data) setPlan(data.demo.plan); }, [data?.demo.plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPlan = useCallback((p: Plan) => setPlan(p), []);
  const chat = useAgentChat(data?.demo.plan ?? null, onPlan);

  const waveSent = events.some((e) => e.type === "offer_sent" && e.payload.wave === 1);
  const now = data ? istMinutes(data.demo.clock_at) : 0;
  const stage: Stage = !plan ? "idle" : plan.status !== "approved" && !waveSent ? "plan" : !waveSent ? "customers" : now >= 20 * 60 ? "done" : "live";

  // The agent speaks the 1:30 pm footfall alert out loud when it happens.
  const spoken = useRef(new Set<string>());
  useEffect(() => {
    const alert = events.find((e) => e.type === "footfall_alert");
    if (alert && !spoken.current.has(alert.id) && stage === "live") {
      spoken.current.add(alert.id);
      chat.say(String(alert.payload.text));
    }
  }, [events, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function post(url: string, body: unknown) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async function runSteps(label: string, steps: Step[], gap: number) {
    setBusy(label);
    for (const s of steps) {
      await post("/api/demo/clock", { to: s.to, simulate: data?.demo.mode === "demo" ? s.simulate ?? [] : [] });
      await sleep(gap);
    }
    setBusy(null);
  }

  const next = (() => {
    if (!data) return null;
    if (stage === "idle") return { label: "Start my day", run: () => chat.wake() };
    if (stage === "plan") return { label: "Approve plan", run: () => chat.approve() };
    if (stage === "customers") return {
      label: data.demo.mode === "demo" ? "Send offers at 11:30 am" : "Send offers now",
      run: async () => { setBusy("Sending offers…"); await post("/api/agent/wave", { wave: 1, clock: data.demo.mode === "demo" ? "11:30" : undefined }); setBusy(null); },
    };
    if (stage === "live" && now < 13 * 60 + 30) return { label: "Skip to 1:30 pm", run: () => runSteps("Moving to 1:30 pm…", MIDDAY, 1200) };
    if (stage === "live" && now < 18 * 60) return { label: "Fast-forward to 6 pm", run: () => runSteps("Fast-forwarding…", AFTERNOON, 900) };
    if (stage === "live") return { label: "Close the day", run: async () => { await post("/api/demo/clock", { to: "20:00" }); window.location.href = "/merchant/summary"; } };
    return { label: "See the day report", run: () => { window.location.href = "/merchant/summary"; } };
  })();

  return (
    <AppShell title="Empty Seat Agent" crumbs={["Agents"]}
      actions={data && <div className="flex items-center gap-4"><div className="hidden md:block"><DayStats data={data} /></div><DemoBar demo={data.demo} /></div>}>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-danger">Could not load today: {error}</p>}
      {!data && !error && <p className="text-muted">Loading today&apos;s chairs…</p>}
      {data && (
        <div className="space-y-4">
          <FlowBar stage={stage} next={next} busy={busy} />

          {stage === "idle" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="relative">
                <div className="pointer-events-none opacity-60"><Calendar data={data} /></div>
                <div className="absolute inset-0 flex items-start justify-center pt-24">
                  <div className="w-[420px] rounded-2xl border border-line bg-surface p-6 text-center shadow-xl">
                    <Sun className="mx-auto h-8 w-8 text-sold" />
                    <h2 className="mt-3 text-[22px] font-semibold text-ink">Good morning, {data.merchant.owner_name}</h2>
                    <p className="mt-1 text-[14px] text-muted">{emptySlotCount(data.slots)} chairs are empty today, mostly after lunch.</p>
                    <button onClick={() => chat.wake()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-[#1849d6]">
                      Start my day <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="h-[620px]"><AgentPanel chat={chat} plan={plan} ownerName={data.merchant.owner_name} asleep /></div>
            </div>
          )}

          {stage === "plan" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-3"><Calendar data={data} /><CalendarLegend /></div>
              <div className="h-[660px]"><AgentPanel chat={chat} plan={plan} ownerName={data.merchant.owner_name} asleep={false} /></div>
            </div>
          )}

          {stage === "customers" && <WaveView mode={data.demo.mode} onSent={reload} hideSend />}

          {(stage === "live" || stage === "done") && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
              <div className="min-w-0 space-y-3">
                <AgentBar chat={chat} />
                <Calendar data={data} pxPerMin={0.85} />
                <CalendarLegend />
                <ActivityFeed events={events} limit={5} />
              </div>
              <LivePhone />
            </div>
          )}
          <PaymentToasts events={events} />
        </div>
      )}
    </AppShell>
  );
}

const STEPS: { id: Stage; label: string }[] = [
  { id: "plan", label: "Morning plan" }, { id: "customers", label: "Choose customers" }, { id: "live", label: "Live sales" }, { id: "done", label: "Day report" },
];

function FlowBar({ stage, next, busy }: { stage: Stage; next: { label: string; run: () => void } | null; busy: string | null }) {
  const order: Stage[] = ["idle", "plan", "customers", "live", "done"];
  const at = order.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
      <ol className="flex flex-wrap items-center gap-2 text-[13px]">
        {STEPS.map((s, i) => {
          const idx = order.indexOf(s.id);
          const done = at > idx, current = at === idx || (stage === "idle" && i === 0);
          return (
            <li key={s.id} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-6 bg-line-2" />}
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${done ? "bg-success text-white" : current ? "bg-accent text-white" : "bg-background text-muted"}`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={current ? "font-semibold text-ink" : done ? "text-ink-2" : "text-muted"}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      {next && (
        <button onClick={next.run} disabled={!!busy}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#1849d6] disabled:opacity-60">
          {busy ?? next.label} {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

/** During the day the agent sits above the board: its latest words, and a place to talk to it. */
function AgentBar({ chat }: { chat: ReturnType<typeof useAgentChat> }) {
  const last = [...chat.lines].reverse().find((l) => l.from === "agent");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <AgentOrb state={chat.state} size={30} />
      <p className="min-w-[200px] flex-1 text-[14px] leading-snug text-ink">
        {last ? last.text : "Offers are out. I'll tell you when something changes."}
      </p>
      <div className="w-full md:w-[360px]"><AskBar chat={chat} placeholder="Ask your agent, e.g. how are we doing?" compact /></div>
    </div>
  );
}

/** "₹380 received" slides in with a chime whenever a slot is paid. */
function PaymentToasts({ events }: { events: AgentEvent[] }) {
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<AgentEvent[]>([]);
  useEffect(() => {
    const paid = events.filter((e) => e.type === "paid");
    if (seen.current === null) { seen.current = new Set(paid.map((e) => e.id)); return; }
    const fresh = paid.filter((e) => !seen.current!.has(e.id));
    if (!fresh.length) return;
    fresh.forEach((e) => seen.current!.add(e.id));
    chime();
    setToasts((t) => [...fresh, ...t].slice(0, 3));
    const ids = fresh.map((e) => e.id);
    setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 4500);
  }, [events]);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((e) => {
        const p = e.payload as { customer?: string; amount?: number; funded?: number; start_at?: string };
        const when = p.start_at ? istMinutes(p.start_at) : 0;
        const h = Math.floor(when / 60), m = when % 60;
        return (
          <div key={e.id} className="flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-white shadow-2xl" style={{ animation: "toast-in .35s ease" }}>
            <CheckCircle2 className="h-5 w-5 text-[#4ade80]" />
            <span className="text-[14px]">
              <b className="tnum">{rupees((p.amount ?? 0) + (p.funded ?? 0))} received</b>
              <span className="text-white/70"> · {p.customer?.split(" ")[0]} · {((h + 11) % 12) + 1}{m ? `:${String(m).padStart(2, "0")}` : ""} {h < 12 ? "am" : "pm"}</span>
            </span>
          </div>
        );
      })}
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}


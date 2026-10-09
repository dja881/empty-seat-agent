"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Calendar, CalendarLegend } from "@/components/Calendar";
import { DayStats } from "@/components/DayStats";
import { DemoBar } from "@/components/agent/DemoBar";
import { PlanPanel, StatusBadge } from "@/components/agent/PlanPanel";
import { WaveView } from "@/components/agent/WaveView";
import { ActivityFeed } from "@/components/agent/ActivityFeed";
import { LivePhone } from "@/components/agent/LivePhone";
import { useBoardData } from "@/lib/useBoardData";
import { useEvents } from "@/lib/useEvents";
import { formatClockFull } from "@/lib/time";

type View = "board" | "customers";

/** Screens 1 to 3: morning plan, choosing customers, and the live board with the customer's phone. */
export default function MerchantPage() {
  const { data, error, reload } = useBoardData();
  const events = useEvents();
  const [view, setView] = useState<View>("board");
  const plan = data?.demo.plan ?? null;
  const approved = plan?.status === "approved";
  const waveSent = events.some((e) => e.type === "offer_sent" && e.payload.wave === 1);

  // After approval the next step is choosing customers; after the wave goes out, the live board.
  useEffect(() => { if (approved && !waveSent) setView("customers"); }, [approved, waveSent]);
  useEffect(() => { if (waveSent) setView("board"); }, [waveSent]);

  const alert = events.find((e) => e.type === "footfall_alert");

  return (
    <AppShell
      title="Empty Seat Agent"
      crumbs={["Agents", "Empty Seat Agent"]}
      actions={data && (
        <div className="flex items-center gap-4">
          <div className="hidden md:block"><DayStats data={data} /></div>
          <DemoBar demo={data.demo} onReset={reload} />
        </div>
      )}
    >
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-danger">Could not load today: {error}</p>}
      {!data && !error && <p className="text-muted">Loading today&apos;s chairs…</p>}
      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
              {(["board", "customers"] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)} disabled={v === "customers" && !approved}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium disabled:opacity-40 ${view === v ? "bg-background text-ink" : "text-muted hover:text-ink"}`}>
                  {v === "board" ? "Chair board" : "Customers"}
                </button>
              ))}
            </div>
            {plan && <StatusBadge status={plan.status} />}
          </div>

          {alert && view === "board" && (
            <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-[13px] text-ink">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="flex-1">
                <b className="font-semibold">{formatClockFull(alert.clock_at ?? alert.created_at)}</b> · {String(alert.payload.text)} Offered to the next customer in wave 2.
              </span>
            </div>
          )}

          {view === "customers" && approved && (
            <WaveView mode={data.demo.mode} onSent={() => setView("board")} />
          )}

          {view === "board" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-3">
                <Calendar data={data} pxPerMin={waveSent ? 0.9 : 1} />
                <CalendarLegend />
                {waveSent && <ActivityFeed events={events} limit={8} />}
              </div>
              <div className="min-w-0">
                {waveSent
                  ? <LivePhone />
                  : <PlanPanel plan={plan} ownerName={data.merchant.owner_name} onApproved={() => { reload(); setView("customers"); }} />}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

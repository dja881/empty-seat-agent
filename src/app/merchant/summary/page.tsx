"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Calendar } from "@/components/Calendar";
import { DemoBar } from "@/components/agent/DemoBar";
import { useBoardData } from "@/lib/useBoardData";
import { rupees } from "@/lib/time";

interface Report {
  clock: string; recovered: number; sold: number; released: number; fill: number; discount: number; funded: number;
  newCustomers: number; walkIns: number; callMe: number; sent: number; frontDesk: number;
  benchmark: { you: number; nearby: number; merchants: number } | null;
  learnings: string[]; weekly: string;
  payments: { time: string; customer: string; isNew: boolean; service: string; chair: number; amount: number; paidByCustomer: number; offer: string; status: string; paymentId: string | null }[];
}

/** Screen 5: the end-of-day report. Every number comes from today's rows. */
export default function SummaryPage() {
  const { data } = useBoardData();
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => { fetch("/api/report").then((x) => x.json()).then(setR); }, [data?.slots.length]);

  return (
    <AppShell title="Daily report" crumbs={["Agents", "Empty Seat Agent", "Tue, 13 Oct"]}
      actions={data && <DemoBar demo={data.demo} />}>
      {!r && <p className="text-muted">Adding up today…</p>}
      {r && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Recovered revenue" value={rupees(r.recovered)} sub="Net of discounts, all prepaid" accent />
            <Kpi label="Slots sold" value={<>{r.sold} <span className="text-[15px] font-normal text-muted">/ {r.released}</span></>} sub={`${Math.round(r.fill * 100)}% of released time`} />
            <Kpi label="Discount given" value={rupees(r.discount)} sub={`${rupees(r.funded)} funded by HDFC Bank`} />
            <Kpi label="New customers" value={r.newCustomers} sub="Via bring a friend" />
            <Kpi label="Walk-ins in held time" value={r.walkIns} sub={`${r.callMe} asked Sneha to call`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Payments</div>
                <table className="w-full min-w-[620px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-muted">
                      <th className="px-4 py-2 font-medium">Slot</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Service</th>
                      <th className="px-3 py-2 text-right font-medium">Salon receives</th>
                      <th className="px-3 py-2 font-medium">Offer</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.payments.map((p, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="tnum px-4 py-2.5 text-ink">{p.time}</td>
                        <td className="px-3 py-2.5 text-ink">
                          {p.customer} {p.isNew && <span className="ml-1 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">New</span>}
                        </td>
                        <td className="px-3 py-2.5 text-ink-2">{p.service} · Ch {p.chair}</td>
                        <td className="tnum px-3 py-2.5 text-right font-medium text-ink">{rupees(p.amount)}</td>
                        <td className="px-3 py-2.5 text-ink-2">{p.offer}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">{p.status}</span>
                          {p.paymentId && <span className="ml-2 font-mono text-[11px] text-faint">{p.paymentId}</span>}
                        </td>
                      </tr>
                    ))}
                    {!r.payments.length && <tr><td colSpan={6} className="px-4 py-4 text-muted">No paid slots yet today.</td></tr>}
                  </tbody>
                </table>
              </div>
              {data && <Calendar data={data} pxPerMin={0.55} />}
            </div>

            <div className="space-y-4">
              {r.benchmark && (
                <div className="rounded-xl border border-line bg-surface p-4">
                  <div className="text-[13px] font-semibold text-ink">Benchmark</div>
                  <p className="text-[12px] text-muted">Same-day fill of released afternoon time</p>
                  <Bar label="You" value={r.benchmark.you} color="bg-accent" />
                  <Bar label="Similar salons nearby" value={r.benchmark.nearby} color="bg-line-2" />
                  <p className="mt-2 text-[11.5px] text-faint">Pooled from {r.benchmark.merchants} salons in Hyderabad.</p>
                </div>
              )}
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="text-[13px] font-semibold text-ink">What the agent learned</div>
                <ul className="mt-2 space-y-2 text-[13px] leading-snug text-ink-2">
                  {r.learnings.map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-ink">Weekly pattern</div>
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">Suggestion</span>
                </div>
                <p className="mt-2 text-[13px] leading-snug text-ink-2">{r.weekly}</p>
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white">Create pass</button>
                  <button className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-2">Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`tnum mt-0.5 text-[24px] font-semibold leading-tight ${accent ? "text-success" : "text-ink"}`}>{value}</div>
      <div className="mt-0.5 text-[12px] text-muted">{sub}</div>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[12.5px]"><span className="text-ink-2">{label}</span><span className="tnum font-medium text-ink">{Math.round(value * 100)}%</span></div>
      <div className="mt-1 h-2 rounded-full bg-background"><div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, value * 100)}%` }} /></div>
    </div>
  );
}

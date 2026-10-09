"use client";

import { useCallback, useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { DayStats } from "@/components/DayStats";
import { supabase } from "@/lib/supabase";
import { useBoardData } from "@/lib/useBoardData";
import { formatClockFull, rupees } from "@/lib/time";

interface Row { id: string; customer: string; customerId: string; sub: string; service: string; start: number; chair: number; stylist: string; price: number; status: string }
interface Call { customer?: string; customer_id?: string; reason?: string; clock: string }

const TABS = [
  { id: "all", label: "All", match: () => true },
  { id: "action", label: "Needs action", match: (r: Row) => r.status === "call_me" || r.status === "replied" },
  { id: "paid", label: "Paid", match: (r: Row) => r.status === "paid" },
  { id: "open", label: "Open", match: (r: Row) => r.status === "sent" || r.status === "link_sent" },
  { id: "closed", label: "Expired", match: (r: Row) => r.status === "expired" || r.status === "cancelled" },
];

const STATUS: Record<string, [string, string]> = {
  call_me: ["Call me", "bg-warn-soft text-warn"],
  replied: ["Replied", "bg-accent-soft text-accent"],
  paid: ["Paid", "bg-success-soft text-success"],
  sent: ["Sent", "bg-background text-ink-2"],
  link_sent: ["Link sent", "bg-background text-ink-2"],
  expired: ["Expired", "bg-background text-muted"],
  cancelled: ["Slot taken", "bg-background text-muted"],
};

const label = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/** Screen 6: Sneha's view. Customers who call get the same deal; booking here locks the slot. */
export default function FrontDeskPage() {
  const { data } = useBoardData();
  const [rows, setRows] = useState<Row[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => fetch("/api/front-desk").then((r) => r.json()).then((d) => { setRows(d.rows); setCalls(d.calls); }), []);
  useEffect(() => {
    load();
    const ch = supabase.channel("front-desk")
      .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function act(op: "send_link" | "mark_booked", offerId: string) {
    setBusy(offerId + op);
    await fetch("/api/front-desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, offerId }) });
    setBusy(null);
    load();
  }

  const call = calls.find((c) => rows.some((r) => r.customerId === c.customer_id && r.status === "call_me"));
  const callRow = call && rows.find((r) => r.customerId === call.customer_id);
  const shown = rows.filter(TABS.find((t) => t.id === tab)!.match);

  return (
    <AppShell title="Today's offers" crumbs={["Agents", "Front desk"]} actions={data && <DayStats data={data} />}>
      <p className="-mt-1 mb-4 text-[13px] text-muted">Signed in as Sneha · Front desk</p>
      {call && callRow && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px]">
          <PhoneCall className="h-4 w-4 text-warn" />
          <span className="flex-1 text-ink">
            <b>{call.customer}</b> wants a call{call.reason ? `: “${call.reason}”` : ""}. Offer {rupees(callRow.price)} if paid now; the same price applies on the phone.
            <span className="ml-2 text-muted">{formatClockFull(call.clock)}</span>
          </span>
          <a href={`tel:+919848010000`} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white">Call</a>
          <button onClick={() => act("send_link", callRow.id)} className="rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-ink-2">Send link</button>
          <button onClick={() => act("mark_booked", callRow.id)} className="rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-ink-2">Mark booked</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <div className="flex gap-4 border-b border-line px-4">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 py-2.5 text-[13px] font-medium ${tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              {t.label} <span className="tnum text-faint">({rows.filter(t.match).length})</span>
            </button>
          ))}
        </div>
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th className="px-4 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">Slot</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const [s, cls] = STATUS[r.status] ?? [r.status, "bg-background text-ink-2"];
              const actionable = r.status !== "paid";
              return (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5"><span className="block font-medium text-ink">{r.customer}</span><span className="block text-[12px] text-muted">{r.sub}</span></td>
                  <td className="px-3 py-2.5 text-ink-2">{r.service} · {label(r.start)} · Ch {r.chair}</td>
                  <td className="tnum px-3 py-2.5 text-right font-medium text-ink">{rupees(r.price)}</td>
                  <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{s}</span></td>
                  <td className="px-4 py-2.5">
                    {actionable ? (
                      <div className="flex gap-2">
                        <button disabled={!!busy} onClick={() => act("send_link", r.id)} className="rounded-md border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:bg-background disabled:opacity-50">Send link</button>
                        <button disabled={!!busy} onClick={() => act("mark_booked", r.id)} className="rounded-md border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:bg-background disabled:opacity-50">Mark booked</button>
                      </div>
                    ) : <span className="text-[12px] text-muted">Booked</span>}
                  </td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No offers here yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted">Marking a slot booked updates the chair board and cancels other open offers for that time.</p>
    </AppShell>
  );
}

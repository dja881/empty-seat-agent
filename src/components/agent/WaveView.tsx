"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { rupees } from "@/lib/time";
import { chairRole } from "@/lib/brand";

interface Row {
  customerId: string; serviceId: string; start: number; name: string; reasons: string[]; service: string; duration: number;
  time: string; chair: number; stylist: string; price: number; list: number; hdfc: boolean; status?: string;
}
interface Preview { checked: number; eligible: number; excludedCounts: Record<string, number>; rows: Row[]; sent?: boolean }

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2);
const TINTS = ["#e0e7ff", "#fce7f3", "#dcfce7", "#fef3c7", "#e0f2fe", "#ede9fe"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Screen 2: who gets the first offers, at what time and price, and why. When the owner sends
 * them, offers go out one by one so you can watch the wave leave.
 */
export function WaveView({ mode, alreadySent, trigger, onSending, onDone }: {
  mode: "demo" | "live"; alreadySent: boolean; trigger: number; onSending?: (label: string | null) => void; onDone?: () => void;
}) {
  const [data, setData] = useState<Preview | null>(null);
  const [status, setStatus] = useState<Record<string, "sending" | "sent">>({});
  const last = useRef(trigger);

  useEffect(() => {
    fetch(`/api/agent/wave${alreadySent ? "?sent=1" : ""}`).then((r) => r.json()).then(setData);
  }, [alreadySent]);

  useEffect(() => {
    if (trigger === last.current || !data || alreadySent) return;
    last.current = trigger;
    (async () => {
      const post = (body: unknown) => fetch("/api/agent/wave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      for (let i = 0; i < data.rows.length; i++) {
        const r = data.rows[i];
        onSending?.(`Sending ${i + 1} of ${data.rows.length}…`);
        setStatus((s) => ({ ...s, [r.customerId]: "sending" }));
        await post({ wave: 1, clock: i === 0 && mode === "demo" ? "11:30" : undefined, row: { customerId: r.customerId, chair: r.chair, start: r.start, serviceId: r.serviceId, price: r.price } });
        setStatus((s) => ({ ...s, [r.customerId]: "sent" }));
        await sleep(350);
      }
      onSending?.("All sent");
      await sleep(1200);
      await post({ wave: 1, finish: true, count: data.rows.length });
      onSending?.(null);
      onDone?.();
    })();
  }, [trigger, data, alreadySent, mode, onSending, onDone]);

  if (!data) return <div className="rounded-xl border border-line bg-surface p-6 text-muted">Ranking your customers…</div>;
  const excluded = Object.values(data.excludedCounts).reduce((a, b) => a + b, 0);
  const preview = data.rows[0];
  const sentCount = Object.values(status).filter((s) => s === "sent").length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[17px] font-semibold text-ink">{alreadySent ? "First offers" : "Who gets the first offers"}</h2>
        <p className="text-[13px] text-muted">
          {alreadySent ? "Sent at 11:30 am from Strand & Co.'s WhatsApp number, signed by Sneha." : "Messages go out at 11:30 am from Strand & Co.'s WhatsApp number, signed by Sneha."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Customers checked" value={data.checked} />
        <Tile label="First offers" value={alreadySent ? data.rows.length : sentCount ? `${sentCount} / ${data.rows.length}` : data.rows.length} accent />
        <Tile label={alreadySent ? "Replied" : "Eligible later"} value={alreadySent ? data.rows.filter((r) => r.status === "replied" || r.status === "paid").length : Math.max(0, data.eligible - data.rows.length)} />
        <Tile label={alreadySent ? "Paid" : "Not contacted"} value={alreadySent ? data.rows.filter((r) => r.status === "paid").length : excluded} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[680px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Matched slot</th>
                <th className="px-3 py-2.5 font-medium">Why this customer</th>
                <th className="px-3 py-2.5 text-right font-medium">Offer</th>
                <th className="w-24 px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => {
                const st: string | undefined = status[r.customerId] ?? r.status;
                return (
                  <tr key={r.customerId} className={`border-b border-line transition-colors last:border-0 ${st === "sending" ? "bg-accent-soft/60" : ""}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-ink-2" style={{ background: TINTS[i % TINTS.length] }}>{initials(r.name)}</span>
                        <span><span className="block font-medium text-ink">{r.name}</span><span className="block text-[12px] text-muted">{r.service} · {r.duration} min</span></span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><span className="tnum block font-medium text-ink">{r.time}</span><span className="block text-[12px] text-muted">Chair {r.chair} · {chairRole(r.chair)}</span></td>
                    <td className="px-3 py-2.5 text-[12.5px] text-ink-2">{r.reasons.join(" · ")}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="tnum block font-semibold text-ink">{rupees(r.price)}</span>
                      <span className="block text-[12px] text-muted">{r.hdfc ? `₹${r.price - 50} on HDFC` : <span className="line-through">{rupees(r.list)}</span>}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">
                      {st === "sending" && <span className="flex items-center gap-1 text-accent"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending</span>}
                      {st === "sent" && <span className="flex items-center gap-1 text-success"><Check className="h-3.5 w-3.5" /> Sent</span>}
                      {st === "replied" && <span className="rounded bg-accent-soft px-1.5 py-0.5 font-medium text-accent">Replied</span>}
                      {st === "paid" && <span className="rounded bg-success-soft px-1.5 py-0.5 font-medium text-success">Paid</span>}
                      {!st && <span className="text-faint">Ready</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {!alreadySent && excluded > 0 && (
            <div className="rounded-xl border border-line bg-surface">
              <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Not contacted ({excluded})</div>
              <ul className="divide-y divide-line text-[13px]">
                {Object.entries(data.excludedCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <li key={k} className="flex justify-between px-4 py-2"><span className="text-ink-2">{k}</span><span className="tnum font-medium">{v}</span></li>
                ))}
              </ul>
            </div>
          )}
          {preview && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-[13px] font-semibold text-ink">The message</div>
              <div className="mt-3 rounded-lg bg-[#efeae2] p-3">
                <div className="rounded-lg rounded-tl-none bg-white p-2.5 text-[12.5px] leading-snug text-[#111b21] shadow-sm">
                  Hi {preview.name.split(" ")[0]}, this is Sneha from Strand & Co. It&apos;s been 6 weeks since your last {preview.service.toLowerCase()}. {preview.time} today: ₹{preview.price} if you pay now{preview.hdfc ? `, or ₹${preview.price - 50} with an HDFC card` : ""}. Usually ₹{preview.list}. Tap to call me anytime.
                  <div className="mt-2 border-t border-[#e9edef] pt-1.5 text-center font-medium text-[#027eb5]">Pay ₹{preview.price}</div>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-muted">Approved WhatsApp template, with Call Sneha and opt-out.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border bg-surface px-4 py-3 ${accent ? "border-accent/40" : "border-line"}`}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`tnum text-[22px] font-semibold ${accent ? "text-accent" : "text-ink"}`}>{value}</div>
    </div>
  );
}

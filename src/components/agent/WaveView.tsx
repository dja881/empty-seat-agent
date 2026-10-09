"use client";

import { useEffect, useState } from "react";
import { rupees } from "@/lib/time";

interface Row {
  customerId: string; name: string; reasons: string[]; service: string; duration: number;
  time: string; chair: number; stylist: string; price: number; list: number; hdfc: boolean;
}
interface Preview { checked: number; eligible: number; excludedCounts: Record<string, number>; rows: Row[] }

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2);
const TINTS = ["#e0e7ff", "#fce7f3", "#dcfce7", "#fef3c7", "#e0f2fe", "#ede9fe"];

/** Screen 2: who gets wave 1, at what time and price, and why. */
export function WaveView({ mode, onSent, hideSend = false }: { mode: "demo" | "live"; onSent: () => void; hideSend?: boolean }) {
  const [data, setData] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => { fetch("/api/agent/wave").then((r) => r.json()).then(setData); }, []);

  async function send() {
    setSending(true);
    await fetch("/api/agent/wave", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wave: 1, clock: mode === "demo" ? "11:30" : undefined }),
    });
    setSending(false);
    onSent();
  }

  if (!data) return <div className="rounded-xl border border-line bg-surface p-6 text-muted">Ranking your customers…</div>;
  const excluded = Object.values(data.excludedCounts).reduce((a, b) => a + b, 0);
  const preview = data.rows[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Customers for wave 1</h2>
          <p className="text-[13px] text-muted">Messages go out at 11:30 am from Glow Salon&apos;s WhatsApp number, signed by Sneha.</p>
        </div>
        {!hideSend && <button onClick={send} disabled={sending}
          className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1849d6] disabled:opacity-60">
          {sending ? "Sending…" : mode === "demo" ? "Send wave 1 at 11:30 am" : "Send wave 1 now"}
        </button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Customers checked" value={data.checked} />
        <Tile label="Wave 1 · 11:30 am" value={data.rows.length} accent />
        <Tile label="Eligible later" value={Math.max(0, data.eligible - data.rows.length)} />
        <Tile label="Not contacted" value={excluded} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Matched slot</th>
                <th className="px-3 py-2.5 font-medium">Why this customer</th>
                <th className="px-4 py-2.5 text-right font-medium">Offer</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.customerId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-ink-2" style={{ background: TINTS[i % TINTS.length] }}>{initials(r.name)}</span>
                      <span>
                        <span className="block font-medium text-ink">{r.name}</span>
                        <span className="block text-[12px] text-muted">{r.service} · {r.duration} min</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="tnum block font-medium text-ink">{r.time}</span>
                    <span className="block text-[12px] text-muted">Chair {r.chair} · {r.stylist}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink-2">{r.reasons.join(" · ")}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="tnum block font-semibold text-ink">{rupees(r.price)}</span>
                    <span className="block text-[12px] text-muted">{r.hdfc ? `₹${r.price - 50} on HDFC` : <span className="line-through">{rupees(r.list)}</span>}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Not contacted ({excluded})</div>
            <ul className="divide-y divide-line text-[13px]">
              {Object.entries(data.excludedCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <li key={k} className="flex justify-between px-4 py-2"><span className="text-ink-2">{k}</span><span className="tnum font-medium">{v}</span></li>
              ))}
            </ul>
          </div>
          {preview && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-[13px] font-semibold text-ink">Message preview</div>
              <div className="mt-3 rounded-lg bg-[#efeae2] p-3">
                <div className="rounded-lg rounded-tl-none bg-white p-2.5 text-[12.5px] leading-snug text-[#111b21] shadow-sm">
                  Hi {preview.name.split(" ")[0]}, this is Sneha from Glow Salon. It&apos;s been a while since your last {preview.service.toLowerCase()}. {preview.time} today: ₹{preview.price} if you pay now{preview.hdfc ? `, or ₹${preview.price - 50} with an HDFC card` : ""}. Usually ₹{preview.list}. Tap to call me anytime.
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

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border bg-surface px-4 py-3 ${accent ? "border-accent/40" : "border-line"}`}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`tnum text-[22px] font-semibold ${accent ? "text-accent" : "text-ink"}`}>{value}</div>
    </div>
  );
}

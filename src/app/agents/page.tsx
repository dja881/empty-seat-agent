"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

interface Round { n: number; customer: { text: string; price?: number }; salon: { text: string; price?: number } }
interface Result {
  rounds: Round[]; deal: number | null; order: string | null; floor: number; customerMax: number;
  opening: number; list: number; when: string; chair: number; stylist: string;
}

/** Screen 4: a customer's AI assistant books tomorrow's slot with the salon's agent. */
export default function AgentsPage() {
  const [max, setMax] = useState(380);
  const [result, setResult] = useState<Result | null>(null);
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);

  async function run(customerMax: number) {
    setRunning(true);
    setResult(null);
    setShown(0);
    const res = await fetch("/api/agents/negotiate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerMax }) });
    const r: Result = await res.json();
    setResult(r);
    for (let i = 1; i <= r.rounds.length; i++) {
      await new Promise((ok) => setTimeout(ok, 1100));
      setShown(i);
    }
    setRunning(false);
  }

  const done = result && shown >= result.rounds.length;
  const salonPrices = result?.rounds.slice(0, shown).map((r) => r.salon.price).filter((p): p is number => !!p) ?? [];
  const customerPrices = result?.rounds.slice(0, shown).map((r) => r.customer.price).filter((p): p is number => !!p) ?? [];

  return (
    <AppShell title={`Booking request from Kavya's assistant`} crumbs={["Agents", "Empty Seat Agent", "Negotiations"]}
      actions={
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted">Customer&apos;s max</span>
          <select value={max} onChange={(e) => setMax(Number(e.target.value))} className="rounded-md border border-line px-2 py-1">
            <option value={380}>₹380 (overlap)</option>
            <option value={330}>₹330 (no overlap)</option>
          </select>
          <button onClick={() => run(max)} disabled={running} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white disabled:opacity-60">
            {running ? "Negotiating…" : result ? "Run again" : "Start negotiation"}
          </button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["1", "Kavya asks her own AI assistant", `“Book me a haircut tomorrow after 3 pm. Don't pay more than ₹${result?.customerMax ?? max}.” Only her assistant knows that limit.`],
            ["2", "It talks to Strand & Co.'s agent", `The salon's agent opens at ₹${result?.opening ?? 400}. Its floor (₹${result?.floor ?? 350}) is set by Priya and checked in code. It trades a prepayment for price instead of just discounting.`],
            ["3", "A deal only where limits overlap", "If the floor is below her maximum, they meet in between and Razorpay takes the prepayment. If not, no deal: she goes on the waitlist."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[11px] text-accent">{n}</span>{t}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="grid grid-cols-[1fr_32px_1fr] gap-3 border-b border-line pb-3 text-[13px]">
            <div className="text-right">
              <div className="font-semibold text-ink">Kavya&apos;s assistant</div>
              <span className="mt-1 inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[11px] text-muted"><Lock className="h-3 w-3" /> Max ₹{result?.customerMax ?? max} · hidden from salon</span>
            </div>
            <div />
            <div>
              <div className="font-semibold text-ink">Empty Seat Agent · Strand & Co.</div>
              <span className="mt-1 inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent"><Lock className="h-3 w-3" /> Floor ₹{result?.floor ?? 350} · hidden from customer</span>
            </div>
          </div>
          <div className="mt-3 space-y-2.5">
            {!result && <p className="py-6 text-center text-[13px] text-muted">{running ? "Connecting the two agents…" : "Press Start negotiation to watch Kavya's assistant book tomorrow's slot."}</p>}
            {result?.rounds.slice(0, shown).map((r) => (
              <div key={r.n} className="grid grid-cols-[1fr_32px_1fr] items-start gap-3">
                <div className="flex justify-end"><p className="max-w-[90%] rounded-lg rounded-tr-none bg-background px-3 py-2 text-[13px] text-ink">{r.customer.text}</p></div>
                <span className="tnum mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-line text-[11px] text-muted">{r.n}</span>
                <div><p className="max-w-[90%] rounded-lg rounded-tl-none bg-accent px-3 py-2 text-[13px] text-white">{r.salon.text}</p></div>
              </div>
            ))}
          </div>
        </div>

        {result && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold text-ink">Price movement</div>
              <div className="flex gap-4 text-[12px] text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted" />Customer</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />Salon</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm border border-success/40 bg-success-soft" />Overlap</span>
              </div>
            </div>
            <PriceLine floor={result.floor} max={result.customerMax} list={result.list} salon={salonPrices} customer={customerPrices} deal={done ? result.deal : null} />
          </div>
        )}

        {done && (
          <div className="grid gap-4 md:grid-cols-[1fr_320px]">
            {result.deal !== null ? (
              <div className="rounded-xl border border-success/40 bg-surface p-4">
                <div className="text-[12px] text-muted">Booking</div>
                <div className="tnum text-[22px] font-semibold text-success">₹{result.deal} · prepaid</div>
                <p className="mt-1 text-[13px] text-ink-2">{result.when} · Chair {result.chair}, {result.stylist}. Razorpay order created; the slot locks on payment.</p>
                {result.order && <p className="mt-2 font-mono text-[11.5px] text-faint">{result.order}</p>}
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="text-[12px] text-muted">No deal</div>
                <div className="text-[18px] font-semibold text-ink">Kavya added to the waitlist</div>
                <p className="mt-1 text-[13px] text-ink-2">Her maximum (₹{result.customerMax}) is below the salon&apos;s floor (₹{result.floor}). The agent held the floor and offered commitment instead of a lower price.</p>
              </div>
            )}
            <div className="rounded-xl border border-line bg-surface p-4 text-[13px] text-ink-2">
              <div className="font-semibold text-ink">How the limits hold</div>
              <p className="mt-1">Razorpay can run both agents, but each only sees its own side&apos;s limit. The floor is checked in code on every offer; a deal closes only where the floor and the maximum overlap.</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PriceLine({ floor, max, list, salon, customer, deal }: { floor: number; max: number; list: number; salon: number[]; customer: number[]; deal: number | null }) {
  const lo = Math.min(280, ...customer) - 10, hi = list + 10;
  const x = (p: number) => `${((p - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="relative mt-6 h-16">
      <div className="absolute inset-x-0 top-6 h-px bg-line-2" />
      {max >= floor && <div className="absolute top-3 h-6 rounded-sm border border-success/40 bg-success-soft" style={{ left: x(floor), width: `calc(${x(max)} - ${x(floor)})` }} />}
      {[...new Set([floor, max, list])].map((p) => (
        <div key={p} className="absolute top-10 -translate-x-1/2 text-center text-[11px] text-muted" style={{ left: x(p) }}>
          ₹{p}<br />{p === floor ? "Floor" : p === max ? "Customer max" : "List"}
        </div>
      ))}
      {customer.map((p, i) => <span key={`c${i}`} className="absolute top-[18px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-muted shadow" style={{ left: x(p) }} />)}
      {salon.map((p, i) => <span key={`s${i}`} className="absolute top-[18px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-accent shadow" style={{ left: x(p) }} />)}
      {deal !== null && (
        <span className="tnum absolute -top-2 -translate-x-1/2 rounded bg-success px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ left: x(deal) }}>Deal ₹{deal}</span>
      )}
    </div>
  );
}

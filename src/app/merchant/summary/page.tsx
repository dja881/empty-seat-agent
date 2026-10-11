"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { DayStats } from "@/components/DayStats";
import { DemoBar } from "@/components/agent/DemoBar";
import { FlowBar } from "@/components/agent/FlowBar";
import { useBoardData } from "@/lib/useBoardData";
import { istMinutes } from "@/lib/time";

interface Booking {
  name: string; service: string; chair: string; time: string; list: number; m: number; b: number; src: string;
  p: number; why: string; rev: number; exp: number; fee: number; extra: number; paid: number; pay: string;
}
interface Report {
  bookings: Booking[];
  totals: { rev: number; exp: number; fee: number; extra: number; paid: number; m: number; b: number; bank: number; brand: number };
  sold: number; released: number; notConverted: number; nearbyTypical: number; feeRate: number; openUnits: number;
  budget: { limit: number; spent: number; reserved: number; available: number; projected: number; perDayLeft: number; days: { label: string; value: number; today: boolean }[] };
  walkIns: { kept: number; came: number; byHour: { label: string; kept: number; came: number }[]; suggest: number; window: string };
}
type Topic = "extra" | "booking" | "expected" | "fee" | "appts" | "spend" | "budget" | "plan";

// One blue family from the prototype's accent.
const BLUE = "#1f5eff", BLUE_MID = "#93b0ff", BLUE_PALE = "#cdd9ff", TRACK = "#e6ebf8";
const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** Day report: what the agent earned, what it cost, and what it suggests for next week. */
export default function SummaryPage() {
  const { data } = useBoardData();
  const [r, setR] = useState<Report | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [bHover, setBHover] = useState<string | null>(null);
  const [hold, setHold] = useState<number | null>(null);
  const [plan, setPlan] = useState<{ state: "pending" | "approved" | "declined"; hold?: number }>({ state: "pending" });
  useEffect(() => { fetch("/api/report").then((x) => x.json()).then(setR); }, [data?.slots.length]);

  const closed = data ? istMinutes(data.demo.clock_at) >= 20 * 60 : false;

  return (
    <AppShell title="RAY" crumbs={["Agents", "Empty seats"]}
      actions={data && <div className="flex items-center gap-4"><div className="hidden md:block"><DayStats data={data} /></div><DemoBar demo={data.demo} /></div>}>
      {data && (
        <div className="mb-4">
          <FlowBar stage={closed ? "done" : "live"} view="done" busy={null}
            next={{ label: "Back to live sales", run: () => { window.location.href = "/merchant?view=live"; } }} />
        </div>
      )}
      {!r && <p className="text-muted">Adding up today…</p>}
      {r && <ReportBody r={r} topic={topic} setTopic={setTopic} hover={hover} setHover={setHover} bHover={bHover} setBHover={setBHover}
        hold={hold ?? r.walkIns.suggest} setHold={setHold} plan={plan} setPlan={setPlan} />}
    </AppShell>
  );
}

function ReportBody({ r, topic, setTopic, hover, setHover, bHover, setBHover, hold, setHold, plan, setPlan }: {
  r: Report; topic: Topic | null; setTopic: (t: Topic | null) => void; hover: string | null; setHover: (s: string | null) => void;
  bHover: string | null; setBHover: (s: string | null) => void; hold: number; setHold: (n: number) => void;
  plan: { state: "pending" | "approved" | "declined"; hold?: number }; setPlan: (p: { state: "pending" | "approved" | "declined"; hold?: number }) => void;
}) {
  const { totals: t, budget: bg, walkIns: w } = r;
  const rev = Math.max(t.rev, 1);

  const kpis: { t: Topic; label: string; value: string; foot: string }[] = [
    { t: "extra", label: "Estimated extra revenue", value: fmt(t.extra), foot: "After agent fee" },
    { t: "appts", label: "Paid appointments", value: String(r.sold), foot: `Out of ${r.released} offered` },
    { t: "spend", label: "Your discount spend", value: fmt(t.m), foot: t.b ? `+${fmt(t.b)} from partner offers` : "No partner offers used" },
  ];

  const slices = [
    { key: "extra", label: "Estimated extra revenue", short: "Estimated extra", value: t.extra, color: BLUE },
    { key: "expected", label: "Expected without offers", short: "Expected anyway", value: t.exp, color: BLUE_MID },
    { key: "fee", label: "Agent fee", short: "Agent fee", value: t.fee, color: BLUE_PALE },
  ];
  const focusKey = hover ?? (slices.some((s) => s.key === topic) ? topic! : "extra");
  const focus = slices.find((s) => s.key === focusKey)!;
  let start = 0;
  const arcs = slices.map((s) => {
    const len = (s.value / rev) * 100;
    const seg = Math.max(len - 0.8, 0.5);
    const arc = { ...s, dash: `${seg} ${100 - seg}`, offset: -start, on: s.key === focusKey };
    start += len;
    return arc;
  });

  const segs = [
    { key: "spent", label: "Spent", v: bg.spent, color: BLUE, note: `${fmt(bg.spent)} committed this month, including ${fmt(t.m)} for today's appointments.` },
    { key: "held", label: "Reserved", v: bg.reserved, color: BLUE_MID, note: `${fmt(bg.reserved)} set aside for live offers. It comes back if they expire unpaid.` },
    { key: "available", label: "Available", v: bg.available, color: TRACK, note: `${fmt(bg.available)} is free for new offers, about ${fmt(bg.perDayLeft)} a day for the rest of October.` },
  ];
  const budgetNote = segs.find((s) => s.key === bHover)?.note ?? `${fmt(bg.available)} is available for new offers this month.`;

  const below = w.came < w.kept - 1;
  const offered = r.openUnits - hold;
  const perSlot = r.sold ? (r.sold / Math.max(r.released, 1)) * (t.extra / r.sold) : 0;
  const planExtra = Math.round((t.extra + (offered - r.released) * perSlot) / 10) * 10;
  const risk = hold > w.came ? "Low" : hold === w.came ? "Medium" : "High";
  const riskNote = hold > w.came + 2
    ? "Likely to leave chairs empty if walk-ins stay as quiet as today."
    : hold > w.came
      ? `Enough room for the ${w.came} walk-ins seen today. RAY stops offering the extra slots by 2 pm if walk-ins pick up.`
      : `At or below today's ${w.came} walk-ins. Some walk-ins may be turned away if the afternoon is busier.`;

  return (
    <div className="space-y-4">
      {/* headline numbers */}
      <section aria-label="Today's numbers" className="grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => {
          const on = topic === k.t;
          return (
            <button key={k.t} onClick={() => setTopic(k.t)} aria-pressed={on}
              className={`flex flex-col gap-2 rounded-xl border bg-surface px-6 py-5 text-left transition hover:bg-[#fafbfd] ${on ? "border-accent shadow-[0_0_0_3px_#dce6fd]" : "border-line"}`}>
              <span className="text-[12px] text-muted">{k.label}</span>
              <span className="tnum text-[28px] font-medium leading-tight tracking-tight text-ink">{k.value}</span>
              <span className="flex items-center justify-between gap-2 text-[12px] text-muted">
                {k.foot}<ArrowUpRight className={`h-3.5 w-3.5 ${on ? "text-accent" : "text-faint"}`} />
              </span>
            </button>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-[4fr_3fr]">
        {/* revenue donut */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-medium text-ink">Your revenue, unpacked</h2>
            <button onClick={() => setTopic("booking")} className="text-[12px] text-ink-2 underline decoration-line-2 underline-offset-[3px] hover:text-ink">{fmt(t.rev)} total</button>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-x-12 gap-y-6">
            <div className="relative h-[224px] w-[224px] flex-none">
              <svg width="224" height="224" viewBox="0 0 220 220" aria-hidden className="-rotate-90 overflow-visible">
                {arcs.map((a) => (
                  <circle key={a.key} cx="110" cy="110" r="88" fill="none" pathLength={100} stroke={a.color}
                    strokeWidth={a.on ? 26 : 22} strokeDasharray={a.dash} strokeDashoffset={a.offset}
                    className="cursor-pointer transition-[stroke-width] duration-200"
                    onClick={() => setTopic(a.key as Topic)} onMouseEnter={() => setHover(a.key)} onMouseLeave={() => setHover(null)} />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[12px] text-muted">{focus.short}</span>
                <span className="tnum text-[28px] font-medium leading-tight tracking-tight text-ink">{fmt(focus.value)}</span>
                <span className="text-[12px] text-muted">{((focus.value / rev) * 100).toFixed(1)}% of revenue</span>
              </div>
            </div>
            <div className="flex max-w-[320px] flex-1 basis-[220px] flex-col gap-0.5">
              {slices.map((s) => (
                <button key={s.key} onClick={() => setTopic(s.key as Topic)} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}
                  className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[14px] ${topic === s.key ? "bg-accent-soft" : hover === s.key ? "bg-[#f5f7fb]" : ""}`}>
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-left text-ink">{s.label}</span>
                  <span className="tnum font-medium text-ink">{fmt(s.value)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* monthly budget */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-[16px] font-medium text-ink">Monthly offer budget</h2>
          <div>
            <span className="flex items-baseline gap-1.5">
              <span className="tnum text-[28px] font-medium tracking-tight text-ink">{fmt(bg.spent)}</span>
              <span className="tnum text-[14px] text-muted">/ {fmt(bg.limit)}</span>
            </span>
            <span className="text-[12px] text-muted">Salon-funded discounts</span>
          </div>
          <div className="flex h-3 gap-[3px]">
            {segs.filter((s) => s.v > 0).map((s) => (
              <button key={s.key} aria-label={`${s.label} ${fmt(s.v)}, view budget breakdown`} onClick={() => setTopic("budget")}
                onMouseEnter={() => setBHover(s.key)} onMouseLeave={() => setBHover(null)}
                className="h-full min-w-1.5 rounded transition-opacity" style={{ flex: `${s.v} 1 0`, background: s.color, opacity: bHover && bHover !== s.key ? 0.45 : 1 }} />
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            {segs.map((s) => (
              <button key={s.key} onClick={() => setTopic("budget")} onMouseEnter={() => setBHover(s.key)} onMouseLeave={() => setBHover(null)}
                className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2 text-[14px] ${bHover === s.key ? "bg-[#f5f7fb]" : ""}`}>
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: s.color, boxShadow: s.key === "available" ? "inset 0 0 0 1px #a9bceb" : undefined }} />
                <span className="flex-1 text-left text-ink">{s.label}</span>
                <span className="tnum font-medium text-ink">{fmt(s.v)}</span>
              </button>
            ))}
          </div>
          <span aria-live="polite" className="min-h-9 text-[12px] text-muted">{budgetNote}</span>
          <button onClick={() => setTopic("budget")} className="mt-auto self-start text-[12px] text-ink-2 underline decoration-line-2 underline-offset-[3px] hover:text-ink">View budget breakdown</button>
        </section>
      </div>

      {topic && <Details r={r} topic={topic} close={() => setTopic(null)} hold={hold} setHold={setHold}
        offered={offered} planExtra={planExtra} risk={risk} riskNote={riskNote}
        approve={() => { setPlan({ state: "approved", hold }); setTopic(null); }}
        decline={() => { setPlan({ state: "declined" }); setHold(w.kept); setTopic(null); }} />}

      {/* what the agent learned */}
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <h2 className="text-[16px] font-medium text-ink">What RAY learned</h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 text-[14px]">
          <div className="min-w-0 flex-1 basis-[260px]">
            <div className="text-[12px] tracking-[.06em] text-muted">TODAY&apos;S SIGNAL</div>
            <div className="text-ink">
              {below ? `Afternoon walk-ins came in below forecast: ${w.came}, not ${w.kept}.` : `Walk-ins matched the plan: ${w.came} came for the ${w.kept} slots kept.`}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-faint" />
          <div className="min-w-0 flex-1 basis-[260px]">
            <div className="text-[12px] tracking-[.06em] text-muted">NEXT TUESDAY</div>
            <div className="text-ink">{below ? "Hold less afternoon time for walk-ins." : "Keep the same time for walk-ins."}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`text-[12px] ${plan.state === "approved" ? "text-success" : "text-muted"}`}>
            {plan.state === "approved" ? `Approved · ${plan.hold} slots held next Tuesday`
              : plan.state === "declined" ? `Keeping ${w.kept} slots next Tuesday` : "Proposed change · needs your approval"}
          </span>
          <button onClick={() => setTopic("plan")} className="min-h-10 rounded-lg bg-accent px-4 text-[14px] font-medium text-white hover:bg-[#1849d6]">
            {plan.state === "pending" ? "Review plan" : "Edit plan"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Details({ r, topic, close, hold, setHold, offered, planExtra, risk, riskNote, approve, decline }: {
  r: Report; topic: Topic; close: () => void; hold: number; setHold: (n: number) => void; offered: number; planExtra: number;
  risk: string; riskNote: string; approve: () => void; decline: () => void;
}) {
  const { totals: t, bookings: A, budget: bg, walkIns: w } = r;
  const saved = t.m + t.b;
  type Ledger = [string, string, boolean?][];
  type Row = { name: string; amount: string; note: string; pct: number; color: string };
  const list = (v: (a: Booking) => number, note: (a: Booking) => string, color: string, minus = false): Row[] => {
    const max = Math.max(...A.map(v), 1);
    return [...A].sort((x, y) => v(y) - v(x)).map((a) => ({
      name: a.name, amount: v(a) ? (minus ? "−" : "") + fmt(v(a)) : "₹0", note: note(a),
      pct: v(a) ? Math.max((v(a) / max) * 100, 3) : 0, color,
    }));
  };

  const T: Record<Topic, { kicker: string; title: string; intro: string; ledger?: Ledger; listTitle?: string; list?: Row[]; note?: string; squares?: boolean; days?: boolean; plan?: boolean }> = {
    extra: {
      kicker: "ESTIMATED EXTRA REVENUE", title: `How ${fmt(t.extra)} adds up`,
      intro: "Money you most likely would not have made today without RAY.",
      ledger: [["Customers paid", fmt(t.paid)], ["Partner offers (banks, brands)", `+${fmt(t.b)}`], ["Booking revenue", fmt(t.rev), true],
        ["Would likely have booked anyway", `−${fmt(t.exp)}`], [`Agent fee, ${Math.round(r.feeRate * 100)}%`, `−${fmt(t.fee)}`], ["Extra revenue", fmt(t.extra), true]],
      listTitle: "By appointment", list: list((a) => a.extra, (a) => `${a.service} · ${a.time}`, BLUE),
      note: "An estimate, not profit after stylist and product costs.",
    },
    booking: {
      kicker: "BOOKING REVENUE", title: `${fmt(t.rev)} from ${r.sold} bookings`,
      intro: `Menu price minus the discount you funded. Partner offers covered another ${fmt(t.b)} of customer discounts.`,
      listTitle: "By appointment",
      list: list((a) => a.rev, (a) => `Menu ${fmt(a.list)} − ${fmt(a.m)} your discount${a.b ? ` · ${fmt(a.b)} ${a.src}` : ""}`, BLUE),
      note: "Payments for future dates are not counted here.",
    },
    expected: {
      kicker: "EXPECTED WITHOUT OFFERS", title: `${fmt(t.exp)} you would likely have got anyway`,
      intro: "Each booking × the chance that customer would have come without an offer. We take this out so RAY only gets credit for new business.",
      listTitle: "Chance they would have booked anyway",
      list: list((a) => a.exp, (a) => (a.p ? `${Math.round(a.p * 100)}% · ${a.why}` : `Unlikely · ${a.why}`), BLUE_MID, true),
      note: "In a pilot, this baseline would be checked against customers and slots that got no offer.",
    },
    fee: {
      kicker: "AGENT FEE", title: `${fmt(t.fee)} agent fee`,
      intro: `You only pay when a customer pays. The ${r.notConverted} offers that did not convert cost nothing.`,
      ledger: [["Booking revenue", fmt(t.rev)], ["Fee rate", `${Math.round(r.feeRate * 100)}%`], ["Agent fee", fmt(t.fee), true]],
      listTitle: "By appointment", list: list((a) => a.fee, (a) => `${Math.round(r.feeRate * 100)}% of ${fmt(a.rev)}`, BLUE_MID, true),
    },
    appts: {
      kicker: "PAID APPOINTMENTS", title: `${r.sold} paid out of ${r.released} offered`,
      intro: `Counted by appointment date. Similar salons nearby averaged ${r.nearbyTypical} on a quiet Tuesday.`,
      squares: true, listTitle: "Today's paid bookings",
      list: list((a) => a.paid, (a) => `${a.service} · ${a.chair} · ${a.time} · ${a.pay}`, BLUE),
    },
    spend: {
      kicker: "DISCOUNT SPEND", title: "Who paid for the discounts",
      intro: `Customers saved ${fmt(saved)} in total. You covered ${fmt(t.m)} of it.`,
      ledger: [["Funded by you", fmt(t.m)], ["Bank offers", fmt(t.bank)], ["Brand offers", fmt(t.brand)], ["Customers saved", fmt(saved), true], ["Your cost per paid booking", fmt(r.sold ? t.m / r.sold : 0)]],
      listTitle: "Discount on each booking",
      list: list((a) => a.m + a.b, (a) => `You ${fmt(a.m)}${a.b ? ` · ${a.src} ${fmt(a.b)}` : " · no partner offer"}`, BLUE),
      note: `Only your ${fmt(t.m)} counts toward the monthly offer budget.`,
    },
    budget: {
      kicker: "MONTHLY OFFER BUDGET", title: `${fmt(bg.available)} left for October`,
      intro: `At this pace you will use about ${fmt(bg.projected)} by 31 Oct, ${bg.projected <= bg.limit * 0.85 ? "well inside the cap" : bg.projected <= bg.limit ? "just inside the cap" : "above the cap, so RAY will slow down discounts"}.`,
      ledger: [["Monthly limit", fmt(bg.limit)], ["Spent so far", `−${fmt(bg.spent)}`], ["Reserved for live offers", `−${fmt(bg.reserved)}`], ["Available", fmt(bg.available), true]],
      days: true, note: "Reserved money returns to the budget if those offers expire unpaid.",
    },
    plan: {
      kicker: "NEXT TUESDAY'S PLAN", title: w.came < w.kept - 1 ? "Keep fewer slots for walk-ins" : "Walk-in hold for next Tuesday",
      intro: `${w.came} walk-ins came today against ${w.kept} slots kept for them. Drag to try a different number.`,
      plan: true,
    },
  };
  const x = T[topic];
  const maxDay = Math.max(...bg.days.map((d) => d.value), 1);

  return (
    <section aria-live="polite" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6" style={{ animation: "rise .3s ease both" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] tracking-[.06em] text-muted">{x.kicker}</div>
          <h2 className="text-[16px] font-medium text-ink">{x.title}</h2>
          <p className="mt-1 max-w-[680px] text-[14px] text-ink-2">{x.intro}</p>
        </div>
        <button onClick={close} aria-label="Close details" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-background text-ink-2 hover:bg-line"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex flex-wrap items-start gap-x-12 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-4">
          {x.ledger && (
            <div>
              {x.ledger.map(([label, value, total]) => (
                <div key={label} className={`flex justify-between gap-3 py-2 text-[14px] ${total ? "mt-1 border-t border-line pt-3 font-medium text-ink" : "text-ink-2"}`}>
                  <span>{label}</span><span className="tnum font-medium text-ink">{value}</span>
                </div>
              ))}
            </div>
          )}
          {x.squares && (
            <div aria-hidden className="flex flex-wrap gap-1.5">
              {Array.from({ length: r.released }, (_, i) => (
                <span key={i} className="h-3.5 w-3.5 rounded-[3px]" style={i < r.sold ? { background: BLUE } : { border: "1.5px dashed #a9bceb", background: "#f5f8ff" }} />
              ))}
            </div>
          )}
          {x.days && (
            <div className="flex flex-col gap-2">
              <span className="text-[12px] text-muted">Spend by agent day</span>
              <div className="flex h-[100px] items-end gap-3">
                {bg.days.map((d) => (
                  <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className={`tnum text-[12px] ${d.today ? "text-ink" : "text-muted"}`}>{fmt(d.value)}</span>
                    <div className="w-full max-w-7 rounded-t" style={{ height: Math.round((d.value / maxDay) * 52), background: d.today ? BLUE : BLUE_PALE }} />
                    <span className={`whitespace-nowrap text-[12px] ${d.today ? "text-ink" : "text-muted"}`}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {x.plan && (
            <div className="flex flex-col gap-4">
              <div className="flex items-end gap-5">
                {w.byHour.map((h) => (
                  <div key={h.label} className="flex flex-col items-center gap-1">
                    <div className="flex h-12 items-end gap-[3px]">
                      <div title={`Kept ${h.kept}`} className="w-3.5 rounded-t-[3px] border-[1.5px] border-dashed border-faint" style={{ height: h.kept * 11 }} />
                      <div title={`Came ${h.came}`} className="w-3.5 rounded-t-[3px]" style={{ height: h.came * 11, background: BLUE }} />
                    </div>
                    <span className="whitespace-nowrap text-[12px] text-muted">{h.label}</span>
                  </div>
                ))}
                <div className="flex flex-col gap-1 pb-[22px] text-[12px] text-muted">
                  <span className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-sm border-[1.5px] border-dashed border-faint" />Slots kept for walk-ins</span>
                  <span className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-sm" style={{ background: BLUE }} />Walk-ins that came</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hold" className="flex justify-between gap-3 text-[14px] text-ink">
                  <span>Slots kept for walk-ins, {w.window}</span>
                  <span className="tnum font-medium text-accent">{hold} slots</span>
                </label>
                <input id="hold" type="range" min={Math.max(2, w.suggest - 2)} max={w.kept} step={1} value={hold} onChange={(e) => setHold(Number(e.target.value))} className="w-full accent-[#1f5eff]" />
                <div className="flex justify-between text-[12px] text-muted">
                  <span>{Math.max(2, w.suggest - 2)}</span><span>RAY suggests {w.suggest} · today {w.kept}</span><span>{w.kept}</span>
                </div>
              </div>
            </div>
          )}
          {x.note && <span className="text-[12px] text-muted">{x.note}</span>}
        </div>

        {x.plan && (
          <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {[["Slots offered", String(offered), ""], ["Extra revenue", fmt(planExtra), ""], ["Walk-in risk", risk, risk === "Low" ? "text-success" : risk === "Medium" ? "text-warn" : "text-danger"]].map(([k, v, c]) => (
                <div key={k} className="rounded-[10px] bg-background p-3">
                  <div className="text-[12px] text-muted">{k}</div>
                  <div className={`tnum text-[16px] font-medium ${c || "text-ink"}`}>{v}</div>
                </div>
              ))}
            </div>
            <span className="text-[12px] text-muted">{riskNote}</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={approve} className="min-h-10 rounded-lg bg-accent px-4 text-[14px] font-medium text-white hover:bg-[#1849d6]">Approve {hold} slots</button>
              <button onClick={decline} className="min-h-10 rounded-lg border border-line bg-surface px-4 text-[14px] text-ink hover:bg-background">Keep {w.kept} slots</button>
            </div>
          </div>
        )}

        {x.list && (
          <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-3">
            <span className="text-[12px] text-muted">{x.listTitle}</span>
            {x.list.map((row, i) => (
              <div key={row.name + i} className="flex flex-col gap-1 text-[14px]">
                <span className="flex justify-between gap-2"><span className="text-ink">{row.name}</span><span className="tnum font-medium text-ink">{row.amount}</span></span>
                <div className="h-1 overflow-hidden rounded-full bg-[#f1f3f6]">
                  <div className="h-full origin-left rounded-full" style={{ width: `${row.pct}%`, background: row.color, animation: "grow .45s cubic-bezier(.2,.8,.2,1) both" }} />
                </div>
                <span className="text-[12px] text-muted">{row.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
    </section>
  );
}

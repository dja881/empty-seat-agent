"use client";

import type { AgentEvent } from "@/lib/types";
import { formatClockFull, istMinutes } from "@/lib/time";

const BADGE: Record<string, [string, string]> = {
  paid: ["Captured", "bg-success-soft text-success"],
  offer_sent: ["Sent", "bg-background text-ink-2"],
  reply: ["Replied", "bg-accent-soft text-accent"],
  footfall_alert: ["Released", "bg-accent-soft text-accent"],
  call_me: ["Call me", "bg-warn-soft text-warn"],
  walk_in: ["Walk-in", "bg-background text-ink-2"],
  refund: ["Refunded", "bg-warn-soft text-warn"],
  waitlist: ["Waitlist", "bg-background text-ink-2"],
  plan_approved: ["Approved", "bg-success-soft text-success"],
  plan_edited: ["Edited", "bg-background text-ink-2"],
};

const label = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`;
};

function describe(e: AgentEvent): string | null {
  const p = e.payload as Record<string, string | number | boolean>;
  switch (e.type) {
    case "paid": {
      const when = p.start_at ? label(istMinutes(String(p.start_at))) : "";
      const funded = Number(p.funded) > 0 ? ` + ₹${p.funded} HDFC` : "";
      return `${p.customer} · ${when} chair ${p.chair} · ₹${p.amount}${funded}${p.simulated ? "" : " via Razorpay"}`;
    }
    case "offer_sent": return p.wave ? `Wave ${p.wave} sent to ${p.count} customers` : `Offer to ${p.customer}: ${p.time}, ₹${p.price}${Number(p.party) > 1 ? ` × ${p.party}` : ""}`;
    case "reply": return `${p.customer}: “${String(p.text).slice(0, 70)}”`;
    case "footfall_alert": return String(p.text);
    case "call_me": return `${p.customer} asked for a call`;
    case "walk_in": return `Walk-in at ${p.start} on chair ${p.chair}, in held time`;
    case "refund": return `Refunded ${p.customer} ₹${p.amount}: ${p.reason}`;
    case "waitlist": return `${p.customer} added to the waitlist`;
    case "plan_approved": return `Plan approved: ${p.released} slots, up to ₹${p.maxDiscount} off`;
    case "plan_edited": return null;
    default: return null;
  }
}

/** What the agent has done today, newest first. */
export function ActivityFeed({ events, limit = 12 }: { events: AgentEvent[]; limit?: number }) {
  const rows = events.map((e) => ({ e, text: describe(e) })).filter((r) => r.text).slice(0, limit);
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Activity</div>
      {rows.length === 0 && <p className="px-4 py-4 text-[13px] text-muted">Nothing yet today.</p>}
      <ul className="divide-y divide-line">
        {rows.map(({ e, text }) => {
          const [badge, cls] = BADGE[e.type] ?? [e.type, "bg-background text-ink-2"];
          return (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
              <span className="tnum w-16 shrink-0 text-[12px] text-muted">{formatClockFull(e.clock_at ?? e.created_at)}</span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{text}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{badge}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

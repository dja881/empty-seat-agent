"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

interface Service { id: string; name: string; duration_min: number; price: number; floor_price: number | null; discountable: boolean }
interface Merchant {
  max_discount: number; allowed_offers: string[]; never_discount_services: string[]; vip_customer_ids: string[];
  daily_message_cap: number; quiet_hours_start: string; quiet_hours_end: string; approval_mode: "ask_first" | "auto_run";
  front_desk_name: string; front_desk_phone: string;
}

const OFFERS = [
  { id: "pay_now", label: "Pay now to lock the slot", hint: "Discount only with prepayment" },
  { id: "friend", label: "Bring a friend", hint: "Each person pays their own share" },
  { id: "bank", label: "Bank-funded offers", hint: "HDFC Bank · ₹50 off · min ₹300", fixed: true },
  { id: "pass", label: "Off-peak pass (UPI Autopay)", hint: "Suggested from weekly patterns" },
];

/** Screen 0: the owner's limits. */
export default function SettingsPage() {
  const [m, setM] = useState<Merchant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [vipQuery, setVipQuery] = useState("");

  const load = () => fetch("/api/settings").then((r) => r.json()).then((d) => { setM(d.merchant); setServices(d.services); setCustomers(d.customers); });
  useEffect(() => { load(); }, []);

  async function save() {
    setSaved("saving");
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merchant: m, services }) });
    setSaved("saved");
    setTimeout(() => setSaved("idle"), 2000);
  }

  const set = <K extends keyof Merchant>(k: K, v: Merchant[K]) => setM((x) => (x ? { ...x, [k]: v } : x));
  const setSvc = (id: string, patch: Partial<Service>) => setServices((xs) => xs.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <AppShell title="Agent limits" crumbs={["Agents", "Empty Seat Agent", "Settings"]}
      actions={
        <div className="flex gap-2">
          <button onClick={load} className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-background">Cancel</button>
          <button onClick={save} disabled={!m || saved === "saving"} className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1849d6] disabled:opacity-60">
            {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : "Save changes"}
          </button>
        </div>
      }>
      <p className="-mt-1 mb-4 text-[13px] text-muted">Every offer the agent makes is checked against these limits in code before it&apos;s sent.</p>
      {!m && <p className="text-muted">Loading…</p>}
      {m && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <Card title="Prices and floors" sub="The floor is what the salon receives, including any bank-funded amount.">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[12px] text-muted"><th className="pb-2 font-medium">Service</th><th className="pb-2 font-medium">List price</th><th className="pb-2 font-medium">Floor</th><th className="pb-2 font-medium">Discount</th></tr></thead>
                <tbody>
                  {services.map((s) => {
                    const never = m.never_discount_services.includes(s.id) || s.floor_price === null;
                    return (
                      <tr key={s.id} className="border-t border-line">
                        <td className="py-2 text-ink">{s.name} <span className="text-muted">· {s.duration_min} min</span></td>
                        <td className="py-2 pr-2"><Money value={s.price} onChange={(v) => setSvc(s.id, { price: v })} /></td>
                        <td className="py-2 pr-2">{never ? <span className="text-[12.5px] text-muted">Not applicable</span> : <Money value={s.floor_price ?? 0} onChange={(v) => setSvc(s.id, { floor_price: v })} />}</td>
                        <td className="py-2">
                          <button onClick={() => {
                            const isNever = m.never_discount_services.includes(s.id);
                            set("never_discount_services", isNever ? m.never_discount_services.filter((x) => x !== s.id) : [...m.never_discount_services, s.id]);
                            if (isNever && s.floor_price === null) setSvc(s.id, { floor_price: Math.round(s.price * 0.8), discountable: true });
                          }} className={`rounded px-2 py-0.5 text-[11.5px] font-medium ${never ? "bg-red-50 text-danger" : "bg-success-soft text-success"}`}>
                            {never ? "Never" : "Allowed"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4">
                <div className="flex justify-between text-[13px]"><span className="text-ink-2">Max discount per slot</span><b className="tnum text-ink">₹{m.max_discount}</b></div>
                <input type="range" min={0} max={300} step={10} value={m.max_discount} onChange={(e) => set("max_discount", Number(e.target.value))} className="mt-2 w-full accent-[#1f5eff]" />
              </div>
            </Card>

            <Card title="Customers never discounted" sub="VIPs get no offers. Regulars who pay full price are excluded automatically.">
              <div className="flex flex-wrap gap-2">
                {m.vip_customer_ids.map((id) => (
                  <span key={id} className="flex items-center gap-1 rounded-md bg-background px-2 py-1 text-[12.5px] text-ink-2">
                    {customers.find((c) => c.id === id)?.name ?? id}
                    <button onClick={() => set("vip_customer_ids", m.vip_customer_ids.filter((x) => x !== id))} aria-label="Remove"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="relative mt-2">
                <input value={vipQuery} onChange={(e) => setVipQuery(e.target.value)} placeholder="Add a customer"
                  className="w-full rounded-lg border border-line px-3 py-1.5 text-[13px] outline-none focus:border-accent" />
                {vipQuery && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-md">
                    {customers.filter((c) => c.name.toLowerCase().includes(vipQuery.toLowerCase()) && !m.vip_customer_ids.includes(c.id)).slice(0, 6).map((c) => (
                      <button key={c.id} onClick={() => { set("vip_customer_ids", [...m.vip_customer_ids, c.id]); setVipQuery(""); }}
                        className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-background">{c.name}</button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Allowed offers">
              {OFFERS.map((o) => {
                const on = o.fixed ? true : m.allowed_offers.includes(o.id);
                return (
                  <label key={o.id} className="flex items-center justify-between border-t border-line py-2.5 first:border-t-0">
                    <span><span className="block text-[13px] font-medium text-ink">{o.label}</span><span className="block text-[12px] text-muted">{o.hint}</span></span>
                    <input type="checkbox" checked={on} disabled={o.fixed}
                      onChange={(e) => set("allowed_offers", e.target.checked ? [...m.allowed_offers, o.id] : m.allowed_offers.filter((x) => x !== o.id))}
                      className="h-4 w-4 accent-[#1f5eff]" />
                  </label>
                );
              })}
            </Card>

            <Card title="Approval mode">
              {([["ask_first", "Ask me every morning", "The plan waits for your approval"], ["auto_run", "Run automatically", "Within the limits on this page"]] as const).map(([id, label, hint]) => (
                <label key={id} className={`mt-2 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 first:mt-0 ${m.approval_mode === id ? "border-accent bg-accent-soft/50" : "border-line"}`}>
                  <input type="radio" checked={m.approval_mode === id} onChange={() => set("approval_mode", id)} className="mt-0.5 accent-[#1f5eff]" />
                  <span><span className="block text-[13px] font-medium text-ink">{label}</span><span className="block text-[12px] text-muted">{hint}</span></span>
                </label>
              ))}
            </Card>

            <Card title="Messaging" sub="Sent from Strand & Co.'s WhatsApp Business number.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Daily message cap"><input type="number" value={m.daily_message_cap} onChange={(e) => set("daily_message_cap", Number(e.target.value))} className="input" /></Field>
                <Field label="Quiet hours">
                  <div className="flex items-center gap-1">
                    <input type="time" value={m.quiet_hours_start.slice(0, 5)} onChange={(e) => set("quiet_hours_start", e.target.value)} className="input" />
                    <span className="text-muted">–</span>
                    <input type="time" value={m.quiet_hours_end.slice(0, 5)} onChange={(e) => set("quiet_hours_end", e.target.value)} className="input" />
                  </div>
                </Field>
                <Field label="Front desk name"><input value={m.front_desk_name} onChange={(e) => set("front_desk_name", e.target.value)} className="input" /></Field>
                <Field label="Front desk number"><input value={m.front_desk_phone} onChange={(e) => set("front_desk_phone", e.target.value)} className="input" /></Field>
              </div>
            </Card>
          </div>
        </div>
      )}
      <style>{`.input{width:100%;border:1px solid var(--color-line);border-radius:8px;padding:6px 10px;font-size:13px;outline:none;background:white}.input:focus{border-color:var(--color-accent)}`}</style>
    </AppShell>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] text-muted">{label}</span>{children}</label>;
}
function Money({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="flex items-center rounded-lg border border-line px-2 focus-within:border-accent">
      <span className="text-muted">₹</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="tnum w-full bg-transparent px-1 py-1.5 text-[13px] outline-none" />
    </span>
  );
}

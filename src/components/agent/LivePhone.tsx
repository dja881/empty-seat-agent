"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * The customer's real phone view, embedded live next to the board. Same page as
 * /phone/[customer], so whatever is typed there reaches the live agent.
 */
export function LivePhone({ initial = "c_riya" }: { initial?: string }) {
  const [customer, setCustomer] = useState(initial);
  const [threads, setThreads] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("messages").select("customer_id, customers(name)").order("created_at");
      const seen = new Map<string, string>();
      for (const m of (data ?? []) as unknown as { customer_id: string; customers: { name: string } }[]) seen.set(m.customer_id, m.customers.name);
      setThreads([...seen.entries()].map(([id, name]) => ({ id, name })));
    };
    load();
    const ch = supabase.channel("threads").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const name = threads.find((t) => t.id === customer)?.name.split(" ")[0] ?? "Customer";
  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex w-[330px] items-center justify-between gap-2 text-[12px]">
        <select value={customer} onChange={(e) => setCustomer(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-[12.5px] text-ink-2">
          {!threads.some((t) => t.id === customer) && <option value={customer}>{name}&apos;s phone</option>}
          {threads.map((t) => <option key={t.id} value={t.id}>{t.name.split(" ")[0]}&apos;s phone</option>)}
        </select>
        <a href={`/phone/${customer}`} target="_blank" className="flex items-center gap-1 text-accent hover:underline">
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="h-[690px] w-[330px] overflow-hidden rounded-[40px] border-[9px] border-[#1c1c1e] bg-black shadow-xl">
        <iframe key={customer} src={`/phone/${customer}`} title={`${name}'s phone`} className="h-full w-full bg-white" />
      </div>
    </div>
  );
}

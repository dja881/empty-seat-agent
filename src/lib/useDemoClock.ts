"use client";

import { useEffect, useState } from "react";
import { MERCHANT_ID, supabase } from "./supabase";

/** The demo clock and mode, kept live. */
export function useDemoClock() {
  const [state, setState] = useState<{ clock_at: string; mode: "demo" | "live"; scripted: boolean } | null>(null);
  useEffect(() => {
    const load = () => supabase.from("demo_state").select("clock_at, mode, scripted").eq("merchant_id", MERCHANT_ID).single()
      .then(({ data }) => data && setState(data));
    load();
    const ch = supabase.channel(`clock-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_state" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return state;
}

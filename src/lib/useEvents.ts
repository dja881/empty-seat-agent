"use client";

import { useEffect, useState } from "react";
import { MERCHANT_ID, supabase } from "./supabase";
import type { AgentEvent } from "./types";

/** The agent's activity log for today, newest first, kept live. */
export function useEvents() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  useEffect(() => {
    const load = () => supabase.from("events").select("*").eq("merchant_id", MERCHANT_ID)
      .order("created_at", { ascending: false }).limit(80)
      .then(({ data }) => data && setEvents(data as AgentEvent[]));
    load();
    const ch = supabase.channel(`events-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return events;
}

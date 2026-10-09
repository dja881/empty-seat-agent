"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MERCHANT_ID, supabase } from "./supabase";
import { istDayRange } from "./time";
import type { Booking, DemoState, Merchant, Service, Slot } from "./types";

export interface BoardData {
  merchant: Merchant;
  services: Service[];
  demo: DemoState;
  bookings: Booking[];
  slots: Slot[];
}

/** Loads today's board and keeps it live through Supabase Realtime. */
export function useBoardData() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [m, s, d] = await Promise.all([
      supabase.from("merchants").select("*").eq("id", MERCHANT_ID).single(),
      supabase.from("services").select("*").eq("merchant_id", MERCHANT_ID),
      supabase.from("demo_state").select("*").eq("merchant_id", MERCHANT_ID).single(),
    ]);
    if (m.error || s.error || d.error) {
      setError((m.error ?? s.error ?? d.error)!.message);
      return;
    }
    const { from, to } = istDayRange(d.data.demo_date);
    const [b, sl] = await Promise.all([
      supabase.from("bookings").select("*, customers(name)").eq("merchant_id", MERCHANT_ID)
        .gte("start_at", from).lt("start_at", to).order("start_at"),
      supabase.from("slots").select("*").eq("merchant_id", MERCHANT_ID)
        .gte("start_at", from).lt("start_at", to).order("start_at"),
    ]);
    if (b.error || sl.error) {
      setError((b.error ?? sl.error)!.message);
      return;
    }
    setError(null);
    setData({ merchant: m.data, services: s.data, demo: d.data, bookings: b.data, slots: sl.data });
  }, []);

  useEffect(() => {
    load();
    // Bursts of changes (a payment touches slot, offers and events) collapse into one reload.
    const reload = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(load, 150);
    };
    const channel = supabase
      .channel("board")
      .on("postgres_changes", { event: "*", schema: "public", table: "slots" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_state" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, reload)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { data, error, reload: load };
}

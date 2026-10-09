"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan } from "./types";
import { useVoice } from "./useVoice";

export interface Line { from: "agent" | "owner"; text: string; reveal?: number }

/**
 * The owner's conversation with the agent: the morning briefing, plan edits before approval,
 * and questions or commands during the day. Every agent line is spoken and revealed in sync.
 */
export function useAgentChat(plan: Plan | null, onPlan: (p: Plan) => void) {
  const [lines, setLines] = useState<Line[]>(() => (plan?.history ?? []).map((h) => ({ from: h.from as Line["from"], text: h.text, reveal: 1 })));
  const [thinking, setThinking] = useState(false);
  const planRef = useRef(plan);
  planRef.current = plan;
  // On a reload mid-morning, pick the conversation back up from the saved plan.
  const live = useRef(false);
  useEffect(() => {
    if (!live.current && plan?.history.length) setLines((ls) => (ls.length ? ls : plan.history.map((h) => ({ from: h.from as Line["from"], text: h.text, reveal: 1 }))));
  }, [plan]);
  const sendRef = useRef<(t: string) => void>(() => {});
  const voice = useVoice((heard) => sendRef.current(heard));

  const say = useCallback(async (text: string) => {
    setLines((ls) => [...ls, { from: "agent", text, reveal: 0 }]);
    const set = (f: number) => setLines((ls) => ls.map((l, i) => (i === ls.length - 1 ? { ...l, reveal: Math.max(l.reveal ?? 0, f) } : l)));
    await voice.speak(text, set);
    set(1);
  }, [voice]);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  };

  /** "Start my day": wake up, build the plan, speak the briefing, then listen. */
  const wake = useCallback(async () => {
    live.current = true;
    setThinking(true);
    const { plan: p, briefing } = await post("/api/agent/plan", { op: "propose" });
    setThinking(false);
    onPlan({ ...p, history: [] });
    await say(briefing);
    if (voice.supported) voice.listen();
  }, [onPlan, say, voice]);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) return;
    live.current = true;
    setLines((ls) => [...ls, { from: "owner", text: t, reveal: 1 }]);
    setThinking(true);
    const approved = planRef.current?.status === "approved" || planRef.current?.status === "paused";
    const json = approved ? await post("/api/agent/ask", { text: t }) : await post("/api/agent/plan", { op: "edit", text: t });
    setThinking(false);
    if (json.plan) onPlan(json.plan);
    if (json.reply) await say(json.reply);
    if (!approved && json.plan?.status === "proposed" && voice.supported) voice.listen();
  }, [onPlan, say, voice]);
  sendRef.current = send;

  const approve = useCallback(async () => {
    voice.stop();
    setThinking(true);
    const json = await post("/api/agent/plan", { op: "approve" });
    setThinking(false);
    if (json.plan) onPlan(json.plan);
    if (json.reply) await say(json.reply);
  }, [onPlan, say, voice]);

  const state: "idle" | "speaking" | "listening" | "thinking" =
    thinking ? "thinking" : voice.speaking ? "speaking" : voice.listening ? "listening" : "idle";

  return { lines, send, wake, approve, say, voice, state, interim: voice.interim };
}

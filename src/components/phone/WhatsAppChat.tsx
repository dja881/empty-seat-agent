"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, CheckCheck, ExternalLink, Phone, Paperclip, SendHorizontal, Video } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatClockFull } from "@/lib/time";

interface Message {
  id: string;
  sender: "salon" | "customer" | "front_desk" | "system";
  body: string;
  payload: { clock?: string; links?: { offer_id: string; label: string }[]; call_button?: boolean; template?: string; receipt?: unknown; call_me?: boolean };
  created_at: string;
}

const SUGGESTIONS = [
  "Can I do 4 instead? Can my sister come too?",
  "Can you do it for less?",
  "Please call me",
];

/** The customer's WhatsApp thread with the salon. Every salon reply is live from the agent. */
export function WhatsAppChat({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => supabase.from("messages").select("*").eq("customer_id", customerId).order("created_at")
      .then(({ data }) => data && setMessages(data as Message[]));
    load();
    const ch = supabase.channel(`thread-${customerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `customer_id=eq.${customerId}` }, (p) => {
        if (p.eventType === "INSERT" && (p.new as Message).sender !== "customer") setTyping(false);
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [customerId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  async function send(body: string) {
    const t = body.trim();
    if (!t) return;
    setText("");
    setError(null);
    setTyping(true);
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, text: t }) });
    if (!res.ok) { setTyping(false); setError("Message not delivered. Tap to retry."); }
  }

  async function callSalon() {
    await fetch("/api/phone/call-me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId }) });
  }

  const hasReplied = messages.some((m) => m.sender === "customer");
  const lastSalon = [...messages].reverse().find((m) => m.sender === "salon");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#efeae2]">
      {/* header */}
      <div className="flex shrink-0 items-center gap-2 bg-[#008069] px-2 py-2 text-white">
        <ArrowLeft className="h-5 w-5" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/glow-logo.svg" alt="" className="h-9 w-9 rounded-full bg-white" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1 text-[16px] font-medium">
            Glow Salon <BadgeCheck className="h-4 w-4 fill-[#25d366] text-[#008069]" />
          </div>
          <div className="text-[12px] text-white/80">{typing ? "typing…" : "Business account"}</div>
        </div>
        <Video className="h-5 w-5 opacity-90" />
        <button onClick={callSalon} aria-label="Call Glow Salon" className="p-2"><Phone className="h-5 w-5" /></button>
      </div>

      {/* thread */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        <div className="mx-auto w-fit rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium uppercase text-[#54656f] shadow-sm">Today</div>
        <div className="mx-auto max-w-[88%] rounded-md bg-[#ffeecd] px-3 py-1.5 text-center text-[11.5px] leading-snug text-[#54656f]">
          This business uses a secure service from Meta to manage this chat. Tap to learn more.
        </div>
        {!messages.length && (
          <div className="mx-auto mt-6 max-w-[80%] text-center text-[12.5px] text-[#54656f]">
            No messages from Glow Salon yet. Offers arrive here once the owner approves today&apos;s plan.
          </div>
        )}
        {messages.map((m) => <Bubble key={m.id} m={m} onLink={(id) => router.push(`/p/${id}?c=${customerId}`)} onCall={callSalon} />)}
        {typing && (
          <div className="w-fit rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm">
            <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${i * 120}ms` }} />)}</span>
          </div>
        )}
        {error && <button onClick={() => setError(null)} className="mx-auto block text-[12px] text-red-600">{error}</button>}
        <div ref={bottom} />
      </div>

      {/* quick replies, alongside the keyboard */}
      {lastSalon && !hasReplied && (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-[#d1d7db] bg-white px-3 py-1.5 text-[12.5px] text-[#111b21] shadow-sm">
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex shrink-0 items-center gap-2 px-2 pb-3 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-sm">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#111b21] outline-none placeholder:text-[#8696a0]" />
          <Paperclip className="h-5 w-5 shrink-0 text-[#54656f]" />
        </div>
        <button type="submit" aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white">
          <SendHorizontal className="h-5 w-5" />
        </button>
      </form>
      <span className="sr-only">Chat with Glow Salon as {customerName}</span>
    </div>
  );
}

function Bubble({ m, onLink, onCall }: { m: Message; onLink: (offerId: string) => void; onCall: () => void }) {
  const time = formatClockFull(m.payload.clock ?? m.created_at);
  if (m.sender === "system") {
    return <div className="mx-auto w-fit max-w-[85%] rounded-md bg-white/90 px-3 py-1 text-center text-[12px] text-[#54656f] shadow-sm">{m.body}</div>;
  }
  const mine = m.sender === "customer";
  const links = m.payload.links ?? [];
  const buttons = links.length > 0 || m.payload.call_button;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] shadow-sm ${mine ? "rounded-lg rounded-tr-none bg-[#d9fdd3]" : "rounded-lg rounded-tl-none bg-white"} ${buttons ? "overflow-hidden" : ""}`}>
        <div className="px-2.5 pb-1.5 pt-1.5">
          <p className="whitespace-pre-wrap text-[14.2px] leading-[19px] text-[#111b21]">{m.body}</p>
          {m.payload.template && <p className="mt-1 text-[12px] text-[#8696a0]">Reply STOP to opt out</p>}
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
            {time}
            {mine && <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />}
          </div>
        </div>
        {links.map((l) => (
          <button key={l.offer_id} onClick={() => onLink(l.offer_id)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-[#e9edef] py-2.5 text-[14px] font-medium text-[#027eb5]">
            <ExternalLink className="h-4 w-4" /> {l.label}
          </button>
        ))}
        {m.payload.call_button && (
          <button onClick={onCall} className="flex w-full items-center justify-center gap-1.5 border-t border-[#e9edef] py-2.5 text-[14px] font-medium text-[#027eb5]">
            <Phone className="h-4 w-4" /> Call Sneha
          </button>
        )}
      </div>
    </div>
  );
}

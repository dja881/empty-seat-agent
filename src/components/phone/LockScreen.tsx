"use client";

import { MessageCircle } from "lucide-react";

/** The customer's phone before they open WhatsApp: the salon's message arrives as a notification. */
export function LockScreen({ clock, from, text, onOpen }: { clock?: string; from?: string; text?: string; onOpen: () => void }) {
  const d = clock ? new Date(clock) : new Date();
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(d).replace(/\s?(am|pm)/i, "");
  const date = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(d);
  return (
    <div className="relative flex h-full flex-col items-center bg-gradient-to-b from-[#1d2b53] via-[#3b3f7a] to-[#7a5c8f] px-4 pt-14 text-white">
      <div className="text-[15px] font-medium text-white/85">{date}</div>
      <div className="tnum text-[76px] font-semibold leading-none tracking-tight">{time}</div>
      {text ? (
        <button onClick={onOpen} className="mt-10 w-full rounded-2xl bg-white/20 p-3 text-left backdrop-blur-xl" style={{ animation: "notif-in .5s ease" }}>
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-wide text-white/75">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#25d366]"><MessageCircle className="h-3.5 w-3.5 text-white" /></span>
            WhatsApp <span className="ml-auto normal-case tracking-normal">now</span>
          </div>
          <div className="mt-1.5 text-[15px] font-semibold">{from}</div>
          <div className="line-clamp-3 text-[14px] leading-snug text-white/90">{text}</div>
        </button>
      ) : (
        <div className="mt-10 text-[13px] text-white/60">No notifications</div>
      )}
      {text && <div className="absolute bottom-8 text-[13px] text-white/70">Tap the notification to open</div>}
      <style>{`@keyframes notif-in{from{opacity:0;transform:translateY(-12px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

"use client";

import { use, useEffect, useState } from "react";
import { PhoneFrame } from "@/components/phone/PhoneFrame";
import { WhatsAppChat } from "@/components/phone/WhatsAppChat";
import { LockScreen } from "@/components/phone/LockScreen";
import { supabase } from "@/lib/supabase";
import { useDemoClock } from "@/lib/useDemoClock";

/** The customer's phone. Open it on a real phone, or in a second window next to the dashboard. */
export default function PhonePage({ params }: { params: Promise<{ customer: string }> }) {
  const { customer } = use(params);
  const id = customer.startsWith("c_") ? customer : `c_${customer}`;
  const clock = useDemoClock();
  const [name, setName] = useState("");
  const [first, setFirst] = useState<{ id: string; body: string } | null | undefined>(undefined);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    supabase.from("customers").select("name").eq("id", id).single().then(({ data }) => data && setName(data.name));
    const load = () => supabase.from("messages").select("id, body, sender").eq("customer_id", id).order("created_at").limit(5)
      .then(({ data }) => {
        const msgs = data ?? [];
        setFirst(msgs.find((m) => m.sender !== "customer") ?? null);
        // Already in a conversation (or opened before): go straight to the chat.
        if (msgs.some((m) => m.sender === "customer")) setOpened(true);
      });
    load();
    const ch = supabase.channel(`phone-${id}-${Math.random()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `customer_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    if (first?.id && sessionStorage.getItem(`opened-${first.id}`)) setOpened(true);
  }, [first?.id]);

  const open = () => { if (first) sessionStorage.setItem(`opened-${first.id}`, "1"); setOpened(true); };
  const showChat = opened || first === undefined;

  return (
    <PhoneFrame clock={clock?.clock_at} dark={showChat}>
      {showChat
        ? <WhatsAppChat customerId={id} customerName={name} />
        : <LockScreen clock={clock?.clock_at} from="Strand & Co." text={first?.body} onOpen={open} />}
    </PhoneFrame>
  );
}

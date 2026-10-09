"use client";

import { use, useEffect, useState } from "react";
import { PhoneFrame } from "@/components/phone/PhoneFrame";
import { WhatsAppChat } from "@/components/phone/WhatsAppChat";
import { supabase } from "@/lib/supabase";
import { useDemoClock } from "@/lib/useDemoClock";

/** The customer's phone. Open it on a real phone, or in a second window next to the dashboard. */
export default function PhonePage({ params }: { params: Promise<{ customer: string }> }) {
  const { customer } = use(params);
  const id = customer.startsWith("c_") ? customer : `c_${customer}`;
  const clock = useDemoClock();
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.from("customers").select("name").eq("id", id).single().then(({ data }) => data && setName(data.name));
  }, [id]);
  return (
    <PhoneFrame clock={clock?.clock_at} dark>
      <WhatsAppChat customerId={id} customerName={name} />
    </PhoneFrame>
  );
}

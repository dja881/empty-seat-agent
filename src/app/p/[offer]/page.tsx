"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { CalendarClock, Check, ChevronLeft, Clock, CreditCard, Lock, Phone, Scissors, Smartphone, Tag } from "lucide-react";
import { PhoneFrame } from "@/components/phone/PhoneFrame";
import { useDemoClock } from "@/lib/useDemoClock";

interface OfferView {
  id: string; status: string; open: boolean; customer: string; phone: string; service: string;
  start: number; stylist: string; chair: number; price: number; funded: number; funder: string | null;
  salon: { name: string; frontDesk: string; phone: string };
  alternatives: { start: number; label: string; stylist: string; price: number }[];
}

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

const label = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/** The page behind the WhatsApp pay link: confirm the slot, pick a method, pay with Razorpay. */
export default function PayPage({ params }: { params: Promise<{ offer: string }> }) {
  const { offer: offerId } = use(params);
  return <Suspense><PayView offerId={offerId} /></Suspense>;
}

function PayView({ offerId }: { offerId: string }) {
  const search = useSearchParams();
  const router = useRouter();
  const clock = useDemoClock();
  const back = search.get("c") ? `/phone/${search.get("c")}` : null;

  const [offer, setOffer] = useState<OfferView | null>(null);
  const [variant, setVariant] = useState<"bank" | "any">("any");
  const [stage, setStage] = useState<"choose" | "paying" | "done" | "taken" | "error">("choose");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/offer/${offerId}`);
    if (!res.ok) { setStage("error"); setMessage("This link isn't valid any more."); return; }
    const o: OfferView = await res.json();
    setOffer(o);
    if (o.funded > 0) setVariant("bank");
    if (o.status === "paid") setStage("done");
    else if (!o.open) setStage("taken");
  }, [offerId]);
  useEffect(() => { load(); }, [load]);

  async function pay() {
    if (!offer) return;
    setStage("paying");
    const res = await fetch("/api/pay/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId, variant }) });
    if (res.status === 409) { await load(); setStage("taken"); return; }
    if (!res.ok || !window.Razorpay) { setStage("error"); setMessage("Couldn't start the payment. Try again."); return; }
    const order = await res.json();
    const bank = order.bankIssuer;
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount * 100,
      currency: "INR",
      name: offer.salon.name,
      description: `${offer.service} · ${label(offer.start)} with ${offer.stylist}`,
      image: location.protocol === "https:" ? `${location.origin}/strand-mark.png` : undefined,
      prefill: { name: order.customer, contact: order.phone },
      notes: { offer_id: offerId },
      theme: { color: "#0c2651" },
      // Test mode: Netbanking first, because its mock bank page always completes (UPI collect and
      // issuer-specific card offers can't be fully simulated). In production Razorpay's default order
      // applies and a Razorpay Offer checks the HDFC card for the bank-funded price.
      ...(order.keyId?.startsWith("rzp_test") ? {
        config: {
          display: {
            blocks: { banks: { name: "Netbanking (fastest in test mode)", instruments: [{ method: "netbanking" }] } },
            sequence: ["block.banks"],
            preferences: { show_default_blocks: true },
          },
        },
      } : {}),
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const v = await fetch("/api/pay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId, variant: bank ? "bank" : "any", ...r }) });
        const { result } = await v.json();
        setPaymentId(r.razorpay_payment_id);
        if (result === "taken") { await load(); setStage("taken"); }
        else setStage("done");
      },
      modal: { ondismiss: () => setStage("choose") },
    });
    rzp.on("payment.failed", () => { setStage("error"); setMessage("The payment didn't go through. You haven't been charged."); });
    rzp.open();
  }

  async function pickAlternative(start: number) {
    const res = await fetch("/api/pay/alternative", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId, start }) });
    if (res.ok) {
      const { offerId: next } = await res.json();
      router.push(`/p/${next}${back ? `?c=${search.get("c")}` : ""}`);
    } else load();
  }

  const amount = offer ? offer.price - (variant === "bank" ? offer.funded : 0) : 0;

  return (
    <PhoneFrame clock={clock?.clock_at}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      {/* in-app browser bar, as when a link opens from WhatsApp */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#eaecf0] bg-[#f7f7f8] px-3 py-2">
        {back ? (
          <button onClick={() => router.push(back)} aria-label="Back to chat" className="p-1"><ChevronLeft className="h-5 w-5 text-[#344054]" /></button>
        ) : <span className="w-7" />}
        <div className="min-w-0 flex-1 text-center leading-tight">
          <div className="truncate text-[13px] font-medium text-[#101828]">Strand & Co. · Secure booking</div>
          <div className="flex items-center justify-center gap-1 truncate text-[11px] text-[#667085]"><Lock className="h-3 w-3" /> pay.strandandco.in</div>
        </div>
        <span className="w-7" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f6f7f9]">
        {!offer && stage !== "error" && <div className="p-6 text-[14px] text-[#667085]">Loading…</div>}

        {offer && (
          <div className="flex items-center gap-3 bg-white px-5 pb-4 pt-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/strand-mark.svg" alt="" className="h-12 w-12 rounded-xl" />
            <div>
              <div className="text-[17px] font-semibold text-[#101828]">{offer.salon.name}</div>
              <div className="text-[13px] text-[#667085]">Madhapur, Hyderabad</div>
            </div>
          </div>
        )}

        {offer && (stage === "choose" || stage === "paying") && (
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="rounded-xl border border-[#eaecf0] bg-white p-4">
              <div className="text-[12px] font-medium uppercase tracking-wide text-[#667085]">Your booking</div>
              <Row icon={<Scissors className="h-4 w-4" />} text={offer.service} sub={`for ${offer.customer}`} />
              <Row icon={<CalendarClock className="h-4 w-4" />} text={`Today, ${label(offer.start)}`} sub={`with ${offer.stylist} · Chair ${offer.chair}`} />
              <Row icon={<Clock className="h-4 w-4" />} text="Held for you until you pay" sub="The slot locks the moment payment succeeds" />
            </div>

            <div className="rounded-xl border border-[#eaecf0] bg-white">
              <div className="px-4 pt-3 text-[12px] font-medium uppercase tracking-wide text-[#667085]">Pay with</div>
              {offer.funded > 0 && (
                <Option selected={variant === "bank"} onClick={() => setVariant("bank")} icon={<CreditCard className="h-5 w-5" />}
                  title="HDFC Bank credit or debit card" price={offer.price - offer.funded} strike={offer.price}
                  note={<span className="flex items-center gap-1 text-[#067647]"><Tag className="h-3.5 w-3.5" /> ₹{offer.funded} off, paid by HDFC Bank</span>} />
              )}
              <Option selected={variant === "any"} onClick={() => setVariant("any")} icon={<Smartphone className="h-5 w-5" />}
                title="UPI, any card or netbanking" price={offer.price} note={<span className="text-[#667085]">GPay, PhonePe, Paytm and more</span>} />
            </div>

            <p className="px-1 text-[12.5px] leading-snug text-[#667085]">
              If someone else books this time a moment before you, you&apos;re refunded straight away and offered the next slot.
            </p>

            <div className="mt-auto space-y-2 pb-2">
              <button onClick={pay} disabled={stage === "paying"}
                className="w-full rounded-xl bg-[#0c2651] py-3.5 text-[16px] font-semibold text-white disabled:opacity-60">
                {stage === "paying" ? "Opening payment…" : `Pay ₹${amount}`}
              </button>
              <div className="flex items-center justify-center gap-1 text-[12px] text-[#667085]">
                <Lock className="h-3 w-3" /> Payments secured by <span className="font-semibold text-[#344054]">Razorpay</span>
              </div>
              <p className="rounded-lg bg-[#fffaeb] px-3 py-2 text-center text-[11.5px] leading-snug text-[#93370d]">
                Test mode, no real money: choose <b>Netbanking</b>, any bank, then tap <b>Success</b>.
              </p>
            </div>
          </div>
        )}

        {offer && stage === "done" && (
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="rounded-xl border border-[#eaecf0] bg-white p-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ecfdf3]"><Check className="h-6 w-6 text-[#067647]" /></div>
              <div className="mt-3 text-[18px] font-semibold text-[#101828]">You&apos;re booked</div>
              <div className="mt-1 text-[14px] text-[#475467]">{offer.service} today at {label(offer.start)} with {offer.stylist}</div>
              {paymentId && <div className="mt-3 font-mono text-[11px] text-[#98a2b3]">Payment ID {paymentId}</div>}
            </div>
            {back && <button onClick={() => router.push(back)} className="rounded-xl border border-[#d0d5dd] bg-white py-3 text-[15px] font-medium text-[#344054]">Back to chat</button>}
          </div>
        )}

        {offer && stage === "taken" && (
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="rounded-xl border border-[#eaecf0] bg-white p-4">
              <div className="flex items-center gap-2 text-[16px] font-semibold text-[#101828]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fffaeb]"><Clock className="h-4 w-4 text-[#b54708]" /></span>
                This slot was just booked
              </div>
              <p className="mt-2 text-[14px] text-[#475467]">
                {offer.service} · Today {label(offer.start)}. {paymentId ? "Your payment is being refunded." : "You haven't been charged."}
                {offer.alternatives.length ? " These times are open at the same price:" : ""}
              </p>
              <div className="mt-3 space-y-2">
                {offer.alternatives.map((a) => (
                  <button key={a.start} onClick={() => pickAlternative(a.start)}
                    className="flex w-full items-center justify-between rounded-lg border border-[#eaecf0] px-3 py-3 text-left hover:border-[#0c2651]">
                    <span className="text-[15px] font-semibold text-[#101828]">{a.label}</span>
                    <span className="flex-1 px-3 text-[13px] text-[#667085]">with {a.stylist}</span>
                    <span className="tnum text-[15px] font-semibold text-[#101828]">₹{a.price}</span>
                  </button>
                ))}
              </div>
            </div>
            <a href={`tel:${offer.salon.phone.replace(/\s/g, "")}`}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-[#0c2651] py-3.5 text-[15px] font-semibold text-white">
              <Phone className="h-4 w-4" /> Call {offer.salon.frontDesk} at the front desk
            </a>
          </div>
        )}

        {stage === "error" && (
          <div className="p-5">
            <p className="text-[14px] text-[#b42318]">{message}</p>
            <button onClick={() => { setStage("choose"); load(); }} className="mt-3 text-[14px] font-medium text-[#0c2651]">Try again</button>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}

function Row({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div className="mt-3 flex gap-3">
      <span className="mt-0.5 text-[#667085]">{icon}</span>
      <span className="leading-tight">
        <span className="block text-[15px] font-medium text-[#101828]">{text}</span>
        <span className="block text-[13px] text-[#667085]">{sub}</span>
      </span>
    </div>
  );
}

function Option({ selected, onClick, icon, title, price, strike, note }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; price: number; strike?: number; note: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 border-t border-[#f2f4f7] px-4 py-3.5 text-left first:border-t-0 ${selected ? "bg-[#f5f8ff]" : ""}`}>
      <span className="text-[#344054]">{icon}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[14.5px] font-medium text-[#101828]">{title}</span>
        <span className="mt-0.5 block text-[12.5px]">{note}</span>
      </span>
      <span className="text-right leading-tight">
        <span className="tnum block text-[15px] font-semibold text-[#101828]">₹{price}</span>
        {strike && <span className="tnum block text-[12px] text-[#98a2b3] line-through">₹{strike}</span>}
      </span>
      <span className={`ml-1 h-5 w-5 shrink-0 rounded-full border-2 ${selected ? "border-[#0c2651] bg-[#0c2651] shadow-[inset_0_0_0_3px_white]" : "border-[#d0d5dd]"}`} />
    </button>
  );
}

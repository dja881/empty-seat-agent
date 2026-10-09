import "server-only";
import { db, logEvent, MERCHANT_ID, must } from "./db";
import { atMinutes, loadDay, parseHHMM, type CustomerRow, type Day } from "./day";
import { matchTimes, rankCustomers } from "./plan";
import { createOffer, openerText, postMessage, refreshOffered } from "./offers";
import { openingPrice } from "./pricing";
import { istDayRange } from "../time";

export async function benchmarks() {
  const rows = must(await db.from("network_benchmarks").select("*").eq("city", "Hyderabad"), "benchmarks") as
    { service: string; day_part: string; lead_time: string; fill_rate: number; median_discount_that_filled: number }[];
  return (serviceName: string) => rows.find((r) => r.service === serviceName && r.day_part === "afternoon" && r.lead_time === "same_day");
}

export async function customersAndOffered(day: Day) {
  const { from, to } = istDayRange(day.demo.demo_date);
  const [cust, offered] = await Promise.all([
    db.from("customers").select("*").eq("merchant_id", MERCHANT_ID),
    db.from("offers").select("customer_id").gte("start_at", from).lt("start_at", to),
  ]);
  return {
    customers: must(cust, "customers") as CustomerRow[],
    offered: new Set((must(offered, "offered") as { customer_id: string }[]).map((o) => o.customer_id)),
  };
}

/** Who gets wave N and at what time and price. Used for the preview and for sending. */
export async function previewWave(day: Day, size = 12) {
  const { customers, offered } = await customersAndOffered(day);
  const ranked = rankCustomers(day, customers, offered);
  const eligible = ranked.filter((r) => !r.excluded);
  const bench = await benchmarks();
  const svc = (id: string) => day.services.find((s) => s.id === id)!;
  const discountable = eligible.filter((r) => {
    const s = svc(r.customer.usual_service_id);
    return s.discountable && !day.merchant.never_discount_services.includes(s.id);
  });
  const matches = matchTimes(day, discountable.slice(0, size), (id) => svc(id).duration_min);
  const rows = matches.map((m) => {
    const service = svc(m.candidate.customer.usual_service_id);
    const price = openingPrice(day, service, bench(service.name)?.median_discount_that_filled ?? 50);
    return { ...m, service, price };
  });
  const excludedCounts: Record<string, number> = {};
  for (const r of ranked) if (r.excluded) excludedCounts[r.excluded] = (excludedCounts[r.excluded] ?? 0) + 1;
  return { rows, excludedCounts, checked: customers.length, eligible: eligible.length };
}

/** Send a wave: one offer per customer, as the approved WhatsApp template with a pay link. */
export async function sendWave(wave: number, size = 12) {
  const day = await loadDay();
  const { rows } = await previewWave(day, size);
  let sent = 0;
  for (const r of rows) {
    const c = r.candidate.customer;
    const { offer } = await createOffer(day, {
      customer: c, service: r.service, chair: r.chair, start: r.start, end: r.end, price: r.price, wave,
    });
    await postMessage(day, c.id, "salon", openerText(day, c, r.service, r.start, r.price), {
      template: "slot_offer_v2", links: [{ offer_id: offer.id, label: `Pay ₹${r.price}` }], call_button: true,
    });
    sent++;
  }
  await refreshOffered();
  await logEvent("offer_sent", { wave, count: sent });
  return sent;
}

export async function setClock(hhmm: string) {
  const day = await loadDay();
  const clock = atMinutes(day.demo.demo_date, parseHHMM(hhmm));
  must(await db.from("demo_state").update({ clock_at: clock, updated_at: new Date().toISOString() })
    .eq("merchant_id", MERCHANT_ID), "clock");
}

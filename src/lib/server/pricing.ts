import "server-only";
import type { CustomerRow, Day, ServiceRow } from "./day";

/**
 * Hard limits, checked in code before any offer is sent. The LLM proposes; this decides.
 * The floor applies to what the salon receives (customer price plus any partner-funded amount),
 * so ₹330 with ₹50 from HDFC clears a ₹350 floor because the salon gets ₹380.
 */
export function limitsFor(day: Day, service: ServiceRow) {
  const plan = day.demo.plan;
  const maxDiscount = Math.min(day.merchant.max_discount, plan?.maxDiscount ?? day.merchant.max_discount);
  const discountable = service.discountable && !day.merchant.never_discount_services.includes(service.id)
    && !(plan?.excludedServices ?? []).includes(service.id);
  const minNet = discountable ? Math.max(service.floor_price ?? service.price, service.price - maxDiscount) : service.price;
  return { list: service.price, minNet, maxDiscount, discountable };
}

/** Opening price for a service: the discount that typically filled similar slots nearby, within limits. */
export function openingPrice(day: Day, service: ServiceRow, medianDiscount: number) {
  const { list, minNet } = limitsFor(day, service);
  return Math.max(minNet, list - medianDiscount);
}

/**
 * Partner money on top of the salon's own discount.
 *   brand: funds a discount on a service that uses its products; applies on any payment method.
 *   bank:  funds a discount on its own cards; applies only if the customer pays with that card.
 */
export interface Funding { funder: string; issuer: string | null; amount: number; kind: "bank" | "brand" }

const brandFor = (day: Day, price: number, serviceId?: string): Funding | null => {
  const f = day.funders.find((x) => x.kind === "brand" && x.service_id === serviceId && price >= x.min_ticket);
  return f ? { funder: f.funder, issuer: null, amount: f.max_funded_amount, kind: "brand" } : null;
};

/** The partner offer that applies to this service at this price, if any. A brand offer takes priority. */
export function anyFunding(day: Day, price: number, serviceId?: string): Funding | null {
  const brand = brandFor(day, price, serviceId);
  if (brand) return brand;
  const f = day.funders.find((x) => x.kind === "bank" && price >= x.min_ticket);
  return f ? { funder: f.funder, issuer: f.card_issuer, amount: f.max_funded_amount, kind: "bank" } : null;
}

/** The partner offer worth mentioning to this customer: a brand offer, or a bank offer on a card they hold. */
export function fundingFor(day: Day, customer: Pick<CustomerRow, "card_issuer"> | null, price: number, serviceId?: string): Funding | null {
  const brand = brandFor(day, price, serviceId);
  if (brand) return brand;
  const f = day.funders.find((x) => x.kind === "bank" && x.card_issuer === customer?.card_issuer && price >= x.min_ticket);
  return f ? { funder: f.funder, issuer: f.card_issuer, amount: f.max_funded_amount, kind: "bank" } : null;
}

/** How a price reads to the customer once the partner offer is counted. */
export function priceLine(price: number, f: Funding | null, each = false) {
  const e = each ? " each" : "";
  if (!f) return `₹${price}${e}`;
  if (f.kind === "brand") return `₹${price - f.amount}${e} (₹${f.amount} off from ${f.funder.split(" ")[0]})`;
  return `₹${price}${e}, or ₹${price - f.amount}${e} with an ${f.issuer} card`;
}

/** Clamp a proposed net price into [minNet, list]; reports whether it had to move. */
export function enforcePrice(day: Day, service: ServiceRow, proposed: number) {
  const { list, minNet } = limitsFor(day, service);
  const price = Math.round(Math.min(list, Math.max(minNet, proposed)) / 10) * 10;
  return { price: Math.max(price, minNet), adjusted: price !== proposed, minNet, list };
}

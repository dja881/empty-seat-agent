import "server-only";
import type { CustomerRow, Day, ServiceRow } from "./day";

/**
 * Hard limits, checked in code before any offer is sent. The LLM proposes; this decides.
 * The floor applies to what the salon receives (customer price plus any bank-funded amount),
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

/** Bank-funded share this customer can get on this price, if any. */
export function fundingFor(day: Day, customer: Pick<CustomerRow, "card_issuer"> | null, price: number) {
  const offer = day.funders.find((f) => f.card_issuer === customer?.card_issuer && price >= f.min_ticket);
  return offer ? { funder: offer.funder, issuer: offer.card_issuer, amount: offer.max_funded_amount } : null;
}

/** Any bank offer that applies at this price, regardless of the customer's known card. */
export function anyFunding(day: Day, price: number) {
  const offer = day.funders.find((f) => price >= f.min_ticket);
  return offer ? { funder: offer.funder, issuer: offer.card_issuer, amount: offer.max_funded_amount } : null;
}

/** Clamp a proposed net price into [minNet, list]; reports whether it had to move. */
export function enforcePrice(day: Day, service: ServiceRow, proposed: number) {
  const { list, minNet } = limitsFor(day, service);
  const price = Math.round(Math.min(list, Math.max(minNet, proposed)) / 10) * 10;
  return { price: Math.max(price, minNet), adjusted: price !== proposed, minNet, list };
}

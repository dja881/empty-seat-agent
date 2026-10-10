// The demo merchant's brand, in one place. Screens read from here; the database row
// (merchants.name) carries the same name for messages the agent writes.
export const BRAND = {
  name: "Strand & Co.",
  descriptor: "Hair Studio · Hyderabad",
  area: "Madhapur, Hyderabad",
  mark: "/strand-mark.svg",        // square icon: dashboard, WhatsApp avatar, pay page
  markPng: "/strand-mark.png",     // Razorpay Checkout needs a raster image
  payDomain: "pay.strandandco.in",
  ink: "#0b1220",                  // the logo's midnight background
} as const;

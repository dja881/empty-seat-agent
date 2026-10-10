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

// Chairs are shown by role, so someone watching the demo knows who works where without
// learning six names. Stylists' names still appear in messages to customers.
export const CHAIR_ROLES = ["Senior stylist", "Stylist", "Stylist", "Colour specialist", "Junior stylist", "Barber"] as const;
export const chairRole = (chair: number) => CHAIR_ROLES[chair - 1] ?? "Stylist";

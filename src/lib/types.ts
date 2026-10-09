export type SlotState = "free" | "held" | "released" | "offered" | "paid" | "cancelled";

export interface Merchant {
  id: string;
  name: string;
  owner_name: string;
  stylists: string[];
  opens_at: string;
  closes_at: string;
  max_discount: number;
  front_desk_name: string;
  logo_url: string | null;
}

export interface Service {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  floor_price: number | null;
  discountable: boolean;
}

export interface Booking {
  id: string;
  customer_id: string | null;
  guest_name: string | null;
  service_id: string;
  chair: number;
  start_at: string;
  end_at: string;
  price: number | null;
  source: "crm" | "walk_in" | "agent" | "front_desk";
  customers?: { name: string } | null;
}

export interface Slot {
  id: string;
  chair: number;
  start_at: string;
  end_at: string;
  state: SlotState;
  walk_in_prob: number | null;
  fill_anyway_prob: number | null;
  parent_slot_id: string | null;
  sold_to: string | null;
  sold_price: number | null;
}

export interface Plan {
  status: "proposed" | "approved" | "skipped" | "paused";
  maxDiscount: number;
  releasedUnits: number;
  heldUnits: number;
  openUnits: number;
  expectedWalkIns: number;
  expectedRevenue: number;
  footfallPct: number;
  salonsPct: number;
  heldHours: string;
  excludedServices: string[];
  keepOpen: string[];
  firstWaveAt: string;
  history: { from: string; text: string }[];
}

export interface DemoState {
  merchant_id: string;
  demo_date: string;
  clock_at: string;
  mode: "demo" | "live";
  scripted: boolean;
  sim_step: number;
  plan: Plan | null;
}

export interface AgentEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  clock_at: string | null;
}

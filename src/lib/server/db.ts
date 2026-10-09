import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client. Server routes only: it bypasses row-level security.
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export const MERCHANT_ID = "glow";

/** Throws on a Supabase error so routes can fail loudly instead of half-writing. */
export function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export async function logEvent(type: string, payload: Record<string, unknown> = {}) {
  await db.from("events").insert({ merchant_id: MERCHANT_ID, type, payload });
}

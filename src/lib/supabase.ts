import { createClient } from "@supabase/supabase-js";

// Browser client: read-only access to the public demo data plus Realtime.
// All writes go through server routes using the service role key.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

export const MERCHANT_ID = "glow";

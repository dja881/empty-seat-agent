import { db } from "@/lib/server/db";

/** Test helper: Riya's open offer ids, space-separated. */
export async function GET() {
  const { data } = await db.from("offers").select("id").eq("customer_id", "c_riya").eq("status", "link_sent");
  return new Response((data ?? []).map((r) => r.id).join(" "));
}

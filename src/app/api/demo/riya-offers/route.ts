import { db } from "@/lib/server/db";

/** Test helper: Riya's open pay link (the lead seat's offer; one payment covers her guest too). */
export async function GET() {
  const { data } = await db.from("offers").select("id").eq("customer_id", "c_riya").eq("status", "link_sent").is("guest_name", null);
  return new Response((data ?? []).map((r) => r.id).join(" "));
}

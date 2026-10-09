// The salon runs on IST. All display and day maths go through these helpers so the
// app behaves the same whatever the viewer's own timezone is.

const IST = "Asia/Kolkata";

/** Minutes since midnight IST for a timestamp. */
export function istMinutes(ts: string | Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ts));
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  return h * 60 + m;
}

/** "10:00" style time string to minutes since midnight. */
export function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** "3 pm", "4:30 pm" */
export function formatClock(ts: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(ts)).replace(":00", "").toLowerCase();
}

/** "9:05 am" with minutes always shown, for the corner clock. */
export function formatClockFull(ts: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(ts)).toLowerCase();
}

export function formatDay(ts: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST, weekday: "long", day: "numeric", month: "short",
  }).format(new Date(ts));
}

/** Start and end of a calendar day in IST, as ISO strings, for range queries. */
export function istDayRange(date: string): { from: string; to: string } {
  const from = new Date(`${date}T00:00:00+05:30`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

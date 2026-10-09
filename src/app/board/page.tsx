"use client";

import { AppShell } from "@/components/shell/AppShell";
import { Calendar, CalendarLegend } from "@/components/Calendar";
import { DayStats } from "@/components/DayStats";
import { useBoardData } from "@/lib/useBoardData";

/** Plain day calendar: today's chairs without the agent panel. */
export default function BoardPage() {
  const { data, error } = useBoardData();
  return (
    <AppShell title="Today's chairs" crumbs={["Calendar"]} actions={data && <DayStats data={data} />}>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-danger">Could not load the calendar: {error}</p>}
      {!data && !error && <p className="text-muted">Loading today&apos;s chairs…</p>}
      {data && (
        <div className="space-y-3">
          <Calendar data={data} />
          <CalendarLegend />
        </div>
      )}
    </AppShell>
  );
}

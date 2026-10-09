"use client";

import { BoardHeader } from "@/components/BoardHeader";
import { BoardLegend, ChairBoard } from "@/components/ChairBoard";
import { useBoardData } from "@/lib/useBoardData";

/** Standalone chair board, used to get the visual anchor right before the rest. */
export default function BoardPage() {
  const { data, error } = useBoardData();
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load the board: {error}</p>}
      {!data && !error && <p className="text-sm text-muted">Loading today&apos;s chairs…</p>}
      {data && (
        <>
          <BoardHeader data={data} />
          <ChairBoard data={data} />
          <BoardLegend />
        </>
      )}
    </main>
  );
}

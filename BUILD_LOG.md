# AI build log

How AI tools were used to build the Empty Seat Agent, and which decisions were mine.

## Decisions made before the build

_To be filled from Daivik's list: idea pivots, merchant segment, pricing, trust design._

## Build log

| Date | Tool | What AI did | Decision I made |
|---|---|---|---|
| 9 Oct | Claude Code | Read the challenge brief and the PRD, and raised gaps and contradictions before writing code: wave size vs customer count, a 4 pm walk-in conflict, who buys the slots in the 2 to 6 pm montage, floor prices stored per merchant instead of per service, webhooks not reaching localhost | Build straight from the PRD, no trimmed spec. Simulator runs only in demo mode, so judges in live mode type as the customer and pay for real in test mode. Quick-reply chips sit alongside a working text input. Reset restores the clock and simulator too |
| 9 Oct | Claude Code + Supabase connector | Created the Supabase project, wrote the 11-table schema plus a demo_state table, and set read-only public access with Realtime | New, separate project so Reset can't touch anything else. Public GitHub repo as the code submission, deployed to Vercel from day one |
| 9 Oct | Claude Code | Wrote a deterministic seed generator: 60 customers across types (due, lapsed, regulars, VIPs, opted out, far away, recent), today's calendar designed to give 32 empty slots, 26.5 free chair-hours and 55.8% full, 90 days of history with walk-ins peaking at 4 pm, and about 52 synthetic merchants' hourly payments running 20% below normal today | Seed numbers must reproduce the PRD's demo day exactly. Hold the 5 pm block for walk-ins and release two 4 pm chairs for Riya and her sister |
| 9 Oct | Claude Code + in-app browser | Built the chair board as a standalone screen with Realtime updates, then checked every block state (booked, free, held, offered, released, paid) against live data | Chair board first, as the visual anchor for the video, before any other screen |

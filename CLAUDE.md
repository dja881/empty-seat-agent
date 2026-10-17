# Empty Seat Agent: notes for Claude

Prototype for the Razorpay × ISB AI PM Build Challenge, Track 2. Deadline: 13 Oct 2026, 11:59 PM IST.
Deliverables: prototype (this repo, public on GitHub as `dja881/empty-seat-agent`), one-page product note,
90-second video, AI build log (`BUILD_LOG.md`).

Read `PROGRESS.md` first for where things stand. Update it after each step.

## Current facts (these override the PRD)

- **Live site: https://empty-seat-agent.vercel.app** (Vercel project `empty-seat-agent`, team `dja`). Every push to `main` deploys automatically. Functions run in Mumbai (`vercel.json`, region bom1) because the Supabase database is in ap-south-1; in the default US region every action took 2 to 8 seconds. It shares the one Supabase database with local dev, so two people using the demo at once interfere (a Restart or "Open Strand & Co." wipes the other's day). The Vercel connector cannot see or create the project. Razorpay webhook: skipped by the user's choice. A GitHub Actions check (`keep-alive.yml`) reads the site and `/api/report` once a day at 07:07 IST (GitHub may start it hours late) so Supabase does not pause; it is read-only and does not disturb the demo.

- The agent is written **RAY** on screen (Razorpay's agent; "Ray" only in code comments and the model prompt). Voice: ElevenLabs **Brian** (`nPczCjzI2devNBz1zQrb`).
- The salon owner in the demo is **Daivik** (was Priya). Landing button reads "Open Strand & Co." (the salon name, not the owner's).
- The hair-spa customer is **Shreya Kulkarni** (was Sneha Kulkarni; id is still `c_sneha_k`), so she is not confused with Sneha at the front desk.
- Riya and her sister pay **once**: one link ("Pay ₹760 for both", ₹660 with HDFC) settles both seats. Two bookings, one Razorpay payment.
- Guided tour: 10 tooltips (`src/lib/tour.ts`, `src/components/tour/Tour.tsx`), targets tagged with `data-tour`. The **Guided tour** switch in the top bar (called "Tips" until 13 Oct) turns it on or off. It is on for every new visit; switching it off lasts only for that browser tab (sessionStorage `tour-off`). Each screen declares its step with `useTourStep`.
- On screen the agent is "RAY · Empty Slot Agent" (from Razorpay Agent Studio). The signal is framed as Razorpay payments near the salon, not "foot traffic": the greeting and the 1:30 pm alert both say so.
- Customers hear from **Sneha**, the front desk. Ray never speaks to customers in his own name.
- Demo salon: **Strand & Co.**, Madhapur, Hyderabad. Internal merchant id is still `glow`.
- Demo day is Tue 13 Oct 2026: 32 empty slots, 22 offered, 10 kept for walk-ins.
- The demo day ends at **7 slots sold, ₹3,160**, but only when the owner cuts the discount to ₹100 in the morning (the regression does). Approved at the default ₹200, Shreya's hair spa sells at ₹1,020 instead of ₹1,100 and the day ends at ₹3,080.
- Agent-to-agent negotiation is removed from the UI (no page, no sidebar item). `negotiate.ts` and `/api/agents/negotiate` remain but nothing links to them.
- Report wording: "Extra revenue" (not "Estimated"), "Out of 22 offered" (the approved plan's number), budget shows Spent and Available only.
- Partner-funded total is **₹200**: HDFC ₹100 (bank, only on HDFC cards) and L'Oréal ₹100 (brand, hair spa, any payment method).
- L'Oréal and HDFC offers are illustrative. No such partnerships exist.
- Chairs are labelled by role (Chair 1 Senior stylist … Chair 6 Barber). Agent-sold slots are green.
- Any number shown in the report, video or product note must match the synthetic data.

## Ground rules

### Safety routine for every change
1. Work on a git branch, never directly on `main`.
2. Check with `npx tsc --noEmit` and `npm run lint`.
3. Run `scripts/run-demo-day.sh` against the running dev server. It must print PASS (7 slots, ₹3,160, ₹200 partner-funded). Read the result before merging; chain the merge with `&&` after the script so a FAIL stops it.
4. Merge to `main` and push only when that passes. Tag versions worth going back to (`working-glow-salon` is the last pre-rebrand one).
5. Reset the demo afterwards (`POST /api/demo/reset`) so the user starts from a clean day.

### Do not
- Do not run `next build` while the user's dev server is running. It overwrites `.next` and breaks the server.
- To test a production build, use a separate git worktree and `next start` on a spare port, and stop it by its own process id. Never a broad `pkill` on next: it took the user's dev server down once.
- Do not start the dev server yourself. The user runs `npm run dev` in their own Terminal tab.
- Do not print, `source` or `cat` `.env.local`. Check only that keys are present. (Values were leaked into a transcript once this way.)
- Do not call ElevenLabs or the model more than needed. Voice clips are cached; no auto-running negotiation or repeated voice lines.
- Do not report a model reply as live without checking its `by` tag (`model` or `script`).
- Do not change code when the user says they want to ideate. Discuss first.

### Product and design
- Show only the optimal core user journey. At every stage the viewer should be focused and wowed. Minimal clutter.
- No "AI-looking" design. Follow real salon tools (Fresha, Square, Zenoti) and the user's own mockups.
- Razorpay does not appear top-left. It appears only where it would in real life (Checkout, test mode).
- Simulator runs only in demo mode. In live mode the judge types as the customer and pays in Razorpay test mode.
- Quick replies always sit alongside a working text input, for owner and customer.
- Reset restores the seeded day, the clock and the simulator.
- The owner can go back and forth between stages and close the day at any time.
- The model proposes, code enforces: floor on what the salon receives, max discount, at most 3 price steps, sellable times only.
- A plan change and a plan approval never happen in the same turn.
- Sneha's price only comes down when the customer raises price. No unasked discounts.

### Working with the user
- Before running the regression, a timing test or a reset (local or live), tell the user and wait for a yes. They all write to the one shared database, so they show up as payments and restarts in whatever the user has open. This ruined a recording attempt on 12 Oct.
- Ask questions in plain text, not with a question dialog.
- Keep `BUILD_LOG.md` up to date as work is done. The top section (decisions before the build) comes from the user.
- Be upfront about what was tested and what was not.

## Where things are

- Stack: Next.js 15.5.27 App Router, Tailwind v4, Supabase (project `empty-seat-agent`, id `kalaaxvocawxfoecvbfn`), Qwen on Cerebras (`qwen-3.8-27b`), Razorpay test mode, ElevenLabs.
- Database: `supabase/migrations/0001` to `0010`. `0002` is generated by `scripts/gen-seed.mjs`. Deployed functions are patched in later migrations rather than regenerated.
- Server logic: `src/lib/server/` (`plan`, `planner`, `pricing`, `offers`, `waves`, `salonAgent`, `settle`, `clock`, `negotiate`).
- Screens: `/` opening, `/merchant` guided day, `/merchant/summary` day report, `/merchant/settings`, `/merchant/front-desk`, `/phone/[customer]`, `/p/[offer]` pay page.
- Razorpay test mode: Netbanking is the reliable method. UPI ID `success@razorpay` works. QR does not.

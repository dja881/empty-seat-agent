# Progress

Updated after each step. Newest entries at the bottom of each list.

_Last updated: 11 Oct 2026_

## Built and working (on `main`, pushed, see git log)

- Database: 13 tables, seeded demo day, reset, first-payment-wins settlement, bank and brand partner offers.
- Ray's morning plan with voice, owner edits by typing or speaking, separate approval step.
- Customer list and wave 1 sent one by one; live WhatsApp-style phone; Sneha's replies from the live model.
- Pay page with real Razorpay Checkout in test mode; signature check; webhook route; refund on double payment.
- Live board: chairs by role, green sold slots, payment toasts with chime, footfall release, wave 2, walk-ins.
- Day report (extra revenue, discount budget, what Ray learned), settings, front desk, agent-to-agent negotiation.
- Rebrand to Strand & Co., opening screen and logo.
- Regression script `scripts/run-demo-day.sh`: last run passed at 7 slots, ₹3,160, ₹200 partner-funded.

## Left to do

### Waiting on the user
- [ ] Import the repo into Vercel with all env vars (the connector cannot create the project).
- [ ] After deploy: create the Razorpay webhook (`/api/razorpay/webhook`, event `payment.captured`).
- [ ] Send the list of pre-build decisions for the top of `BUILD_LOG.md`.
- [ ] Decide: keep L'Oréal as the brand example, or use a made-up brand.
- [ ] Decide: simpler overall structure (three moments / board as stage / phone first).
- [ ] Decide: should the monthly discount budget cap the agent and be editable in Settings.
- [ ] Product note and 90-second video. Any "₹150 funded by HDFC" must become "₹200 from partner offers".

### Claude can do once confirmed
- [ ] `BUILD_LOG.md`: add 10 to 11 Oct work, and fix the 9 Oct row that still says "₹150 HDFC-funded".
- [ ] `README.md`: data section lists only migrations 0001 to 0003.
- [ ] Verify a production build (only when the dev server is stopped, or on Vercel).
- [ ] "Approve next Tuesday's plan" in the report only updates the screen; it is not saved.

### Not tested
- A real Razorpay Checkout payment on a brand-funded (L'Oréal) slot.
- The Razorpay webhook end to end (needs the deployed URL).
- The full flow at full browser width on the deployed site.

## Step log

- 11 Oct: Context reset. Re-read build log, git history, migrations, seed and README. Wrote `CLAUDE.md` and this file. No code changed.
- 11 Oct: Start-screen cleanup. Landing button is now "Open Daivik's salon"; the top-right "Start my day" is hidden until the day starts, so the wake-up card is the only start button; card says "32 slots are empty" (was "chairs"). Owner renamed Priya to Daivik (migration 0011, applied). Regression passed: 7 slots, ₹3,160, ₹200 partner-funded. Confirmed in the browser: one "Start my day" button on the dashboard.
- 11 Oct: Landing button corrected to "Open Strand & Co." (I had wrongly put the owner's name on it). Label-only change; type-check and lint passed, regression not re-run.
- 11 Oct: Reviewer feedback, three fixes. Customer Sneha Kulkarni renamed Shreya Kulkarni (migration 0012, applied). Activity log now says when a customer's slot was taken and they were offered a new time (`offer_moved` event). Sold chair cards say "₹380 earned" instead of "paid". Regression passed: 7 slots, ₹3,160, ₹200 partner-funded. Skipped by choice: HDFC-with-netbanking hint, 22 vs 23 wording in the report. Not looked at: short booking card (Imran), Ray's stale status line at 6 pm. The new activity line and "earned" label were not checked on screen.
- 11 Oct: Fixed: the simulator could buy the slot a live customer had a pay link for (Shreya's first offer was the same 4 pm chair Riya moves to, so skipping ahead before paying lost Riya her booking). The simulator now never buys or overlaps a slot with a link agreed in a conversation, and never buys for that customer. Tested two ways: normal regression (7 slots, ₹3,160, ₹200 partner-funded) and Riya paying late at 3:30 pm (her two links survive, 7 slots, ₹3,160; partner-funded is ₹250 in that order because Divya also uses HDFC).

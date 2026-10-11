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
- 11 Oct: Agent name shown as RAY everywhere on screen. Riya and her sister now pay once: one WhatsApp link, one Razorpay order for both seats, both chairs lock on that payment (`groupOf`, `settleGroup` in `settle.ts`; order, verify, webhook and simulate routes use them). Checked on screen: chat link "Pay ₹760 for both", pay page "2 × Haircut", ₹660 with HDFC, order amount ₹660. Regression passed: 7 slots, ₹3,160, ₹200 partner-funded. Not tested: a real Razorpay Checkout payment for the two-seat order.
- 11 Oct: Four small fixes from the review. (1) "Expected today" now moves with the discount cap: ₹3,100 at ₹200 off, ₹2,600 at ₹100 off. (2) The 1:30 pm footfall alert is a highlighted card above the board for 90 minutes of demo time. (3) The agent fee is 8% of the day's total (₹253 on ₹3,160; estimated extra is now ₹2,351, was ₹2,353). (4) Chair headers show "Chair 1" and the role in full at laptop width. Alert card and headers checked on screen at 1366 px. The regression run for this change came back at ₹3,100, not ₹3,160, and it was merged before the result was read (see next entry).
- 11 Oct: Regression wobble. One run in about seven ended at ₹3,100 (salon-funded discount ₹60 higher, same 7 slots). Most likely cause, not proven because that run's data was reset: the live model gave Riya and her sister ₹30 off each without being asked. Fix: the salon agent's price only comes down when the customer's message is about price (`ASKS_ABOUT_PRICE` in `salonAgent.ts`). Four runs since: all 7 slots, ₹3,160, ₹200. `scripts/run-demo-day.sh` now prints RESULT and PASS/FAIL and exits non-zero on a miss, so a merge can be gated on it.
- 11 Oct: Guided tour built from the user's spec (`ray-tour-spec.html`): 10 steps, blue outline, dimmed page, Back / Next / Skip, auto-advance when the action is done, Tips on/off switch on every screen. Walked through all 10 steps on screen at 1366 px, with Riya's reply and payment sent through the API rather than typed and paid by hand. Differences from the spec: Next presses the highlighted button on button steps (1, 2, 4, 5, 8, 9); step 5 has a second stop on the Send offers button; Back shows only when the earlier step is still on screen; steps 8 and 9 wait about 5 seconds so the green chair and the footfall alert are seen first; step 10 copy and the tile say "after RAY's fee"; Restart demo restarts the tour at step 2 because it lands on the dashboard. Regression passed.
- 12 Oct: Six mockup changes (red numbers 2, 5, 6, 7, 8, 9). Landing chip "RAY · Empty Slot Agent · from Razorpay Agent Studio"; new greeting ("Razorpay payments near you are running 20% below a normal Tuesday…", the "32 open slots" sentence dropped); 1:30 pm alert as a blue card with a "Live signal · Razorpay network" chip, highlighted 4 seconds then settles, plus a "Live signal" activity line; Razorpay network benchmark card on the report; Business type and Data and privacy cards added to settings (nothing removed). Also renamed header and sidebar to "RAY · Empty Slot Agent" as in the mockups, and fixed the settings hint for Bring a friend (one payment covers both). Checked on screen at 1366 px. Regression PASS. Not done: the "chip" in mockup 02, whose image did not come through.
- 12 Oct: Header stat renamed from "Recovered today" to "Booked by RAY". It shows booking revenue (the report's "total"), which read as a mismatch next to "Estimated extra revenue". Label only; regression not re-run.
- 12 Oct: Header stat now shows "Estimated extra revenue", the same figure and name as the report headline (fetched from /api/report, refreshed on each sale). Replaces "Booked by RAY". Checked on the report page: header ₹2,351 = tile ₹2,351. Regression PASS. Payment toasts and chair cards still show the booking amount (₹380 received / earned).
- 12 Oct: Morning plan panel now shows a "Based on Razorpay network signals" card under the greeting (mockup 3): payments nearby 20% below a normal Tuesday, nearby salons quieter than usual, offers nearby work at about ₹70 off a haircut. Figures come from the synthetic data: 42 nearby businesses (not 48 as in the mockup), ₹70 median discount (not "₹70 to ₹100"). "How do you know?" chip left out as asked. Checked on screen. Regression PASS.
- 12 Oct: Cleanup round (user's six-point list). (1) Agent-to-agent removed from the UI: page and sidebar item deleted, /agents returns 404; server code left, unreachable. (2) Network signal block rechecked: shows with the plan card and stays after an edit; wording follows the data (42 businesses, about ₹70 off a haircut), as the user confirmed. (3) 1:30 pm alert appears once: RAY's bar no longer repeats it. (4) Report: "Extra revenue" in tile, header and donut; "Out of 22 offered"; Reserved row removed (budget available = limit minus spent). (5) Tour: step 3 waits until RAY has finished speaking and sits to the left of the input, clear of Approve plan; step 6 waits for the WhatsApp notification; sidebar clicks work while a tooltip shows. (6) Kavya Iyer now visited 20 days ago so she gets no offer (migration 0013, applied), wave 1 still 12; clock reads 9:10 am after approval. Regression PASS. Two full browser runs from the start, Tips on and Tips off, all checks passed; payment simulated in both, Riya's reply typed in the phone in the Tips-on run. Finding: without the "make it ₹100" edit the day ends at ₹3,080, not ₹3,160.
- 12 Oct: Handover from sending offers to the live view no longer cuts: the board fades up, the phone slides in from the right, the lock screen sits quiet for about 2 seconds, then the WhatsApp notification lands. Only when arriving straight from sending; reloads and going back show the view at once. Checked the end state on screen and that the notification arrives; the motion itself was not watched frame by frame. Regression PASS.
- 12 Oct: Production build verified (`next build` in a separate worktree, so the dev server was untouched): compiles, 29 pages, no errors. All 11 keys present in `.env.local`. Vercel: team `dja7` has no projects; creating one through the connector is still refused (403) and there is no Vercel CLI on this machine, so the user has to import the repo in the Vercel dashboard.

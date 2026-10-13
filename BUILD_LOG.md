# RAY · AI build log

**Daivik John Alva | Razorpay × ISB AI PM Build Challenge**

## 1. AI tools and models used

I used AI extensively for research, implementation and review. I chose the problem, merchant segment, product behaviour and scope. AI wrote most of the code, helped investigate the opportunity and proposed alternatives that I reviewed. My main contribution was deciding what to build, specifying how it should behave and testing whether the result met that intent.

| Tool or model | Role in this project |
| --- | --- |
| **Claude / Claude Code** | Secondary research, PRD and specification support, database and application code, integrations, debugging, test scripts and build-log maintenance. |
| **Claude Design** | Visual mockups, the Strand & Co. identity and screen references that I annotated for implementation. |
| **ChatGPT / Codex** | Independent critique of product logic, report calculations and metrics; supporting-source checks; report mockups and interactive HTML; editing the product note and this log. |
| **Qwen (`qwen-3.8-27b`), served through Cerebras** | The model inside RAY. It interprets owner instructions, generates customer replies and answers “Ask RAY” questions. Proposed actions are validated in code. |
| **ElevenLabs** | Generated the agent's voice clips. Repeated lines are cached and replayed. |

The supporting stack was **Next.js, Supabase, Vercel and Razorpay test mode**. These supplied the application, database, live updates, storage, hosting and payments. They were separate from the AI tools used to build it. The names above identify the tools and model families used; I did not preserve a complete version history for the build assistants.

## 2. Key prompts, workflow and agent setup

### My build workflow

1. **Define the behaviour.** I supplied the PRD, business rules, screen references and a coherent synthetic demo day.
2. **Challenge the specification.** I asked AI to find contradictions, missing cases and assumptions before implementing changes.
3. **Implement and review.** Claude Code produced working versions. I walked through them, annotated what was wrong and chose which suggestions to accept.
4. **Check regressions.** After early failures, I required branches, saved working versions and a repeatable demo-day test before merging changes.

Claude Code also worked from two files I had it keep in the repository: a standing instructions file with the current facts and ground rules, and a progress file updated after each step. These carried context from one session to the next.

### Representative instructions

These summarise the instructions used during the build; they are not verbatim prompt transcripts.

**Specification review**

> Read the PRD and challenge brief. Identify contradictions in capacity, customer counts, offer waves, price floors and payment behaviour before writing code. Explain the conflicts so I can decide how to resolve them.

**Implementation**

> Build the chair board and offer-to-payment journey from my specification. Keep plan changes separate from approval. Let the model propose actions, but enforce prices, floors and allowed times in code. Simulated buyers should run only in demo mode.

**Report stress test**

> Check the proposed daily report against the PRD and challenge brief. Check the calculations, booking versus payment dates, capacity units, budget reservations, funding, fees, refunds, controls and learning. Separate must-fix issues from optional additions without expanding scope.

**Review-driven fixes**

> Check each walkthrough finding against the current code before changing it. Fix reproducible issues, preserve the approved journey and run the demo checks before merging.

### Instructions in my own words

Three messages from the build, lightly tidied, that changed its direction:

> Don't make it look too AI. Do some research, look at similar products and find a more realistic design.

> Show only the optimal core user journey. At every stage the person watching should be focused.

> I'm scared that making these changes will break something in our current codebase. Is there a way we can ensure that doesn't happen?

The first led to rebuilding the interface around how salon software lays out a day. The second removed clutter from every screen. The third produced the branch-and-test routine used for every later change.

### Agent setup inside RAY

The morning plan is computed in code: the walk-in forecast, which time to release and the customer ranking come from bookings, walk-in history, synthetic area signals and merchant limits. Qwen interprets the owner's changes to that plan in plain language. The customer-facing agent receives the relevant customer context, available times and approved offers, then returns a structured action and message.

The server validates the proposed price, time and merchant limits before accepting an action. An edit is not approval to send. Requests the agent cannot settle within the permitted offers are handed to the front desk for a call. A scripted fallback supports recording and covers model failures, with responses labelled so it is distinguishable from the live model path.

## 3. One AI output I rejected and corrected

**The live model offered a discount the customer had not requested.**

A demo run finished ₹60 below the expected total, with the same number of bookings. The shortfall matched two haircuts sold at ₹30 less each, and the most likely cause was an unsolicited discount in a model reply to a customer who had only asked to change the time and bring a guest. That run's data had already been reset, so the cause was inferred from the numbers and not confirmed from the conversation itself.

Either way, the behaviour it pointed to was one I did not want: the agent should not give away revenue merely to make its response more helpful.

I decided that the price should only come down when the customer raises price, and any reduction must still remain within the merchant's approved limits. Claude Code implemented that rule in code and updated the demo test to fail on any deviation from the expected result. Repeated runs after the change returned the expected total.

The important correction was moving this constraint out of conversational discretion. A stronger prompt alone would not have been enough. I kept the live model for handling replies, while the application enforced the commercial rule.

## 4. What AI did versus what I decided and built

| I owned | AI contributed |
| --- | --- |
| Choosing empty salon appointments as the problem, the initial merchant segment and the product hypothesis. | Secondary research, comparisons with existing tools, and challenges to assumptions. |
| Conversations with salon staff and customers, and the resulting receptionist-led trust design. | Help organising the findings and translating the requirements into screens and messages. |
| Pay-to-lock booking, offer boundaries, the proposed 8% fee and the need for merchant approval. | Implementation of the booking, payment, agent and validation logic. |
| The visual direction and acceptance of the final experience. I rejected the first generic UI and specified a guided daily journey. | Mockups, interactive alternatives and code revisions based on my references and feedback. |
| Combining a customer and guest into one checkout, prioritising the daily report and cutting agent-to-agent negotiation. | Changing the implementation and checking the resulting flow. |
| Choosing the final metric, scope, claims and submission wording. | Stress-testing the argument, checking calculations and helping edit the submission. |

I did not write most of the implementation code or manually review every generated line. I supplied the logic and acceptance criteria, reviewed the behaviour and made the final product decisions. AI also proposed technical approaches, which I assessed against those requirements.

### How this multiplied my output

During the build, AI helped me create and revise:

- **12 database tables plus a demo-state table.**
- A reproducible dataset with **60 synthetic customers and 90 days of booking history**.
- **Four interface stages** covering planning, customer selection, live sales and reporting, with a **10-step optional guided tour**.
- A payment flow that supports **one checkout for two appointments**.
- Repeated design, pricing, payment and walkthrough corrections, including the **₹60 discount error** above.

AI reduced the manual work between a decision and a testable version. That let me spend more of the build reviewing the journey and making changes instead of only producing the first implementation. These figures describe the output completed; I did not run a timed manual comparison to establish an exact 10× speedup.

## 5. Known limitations, risks and verification

### Checks used during the build

- Repeatable demo-day checks for expected bookings and revenue, with failures blocking a merge under the testing routine I introduced.
- Walkthroughs of the main journey with the guided tour both on and off.
- A Razorpay test-mode payment through Checkout that booked both appointments from one payment, with the payment signature verified on the server.
- Competing payments for the same time resolved in the database, so the first confirmed payment takes the slot.
- Review of plan editing versus approval, slot conflicts and the distinction between the customer's payment and the salon's receipts.
- Separate checks of report arithmetic, attribution, fee treatment and chair-time units.
- Identification of live versus scripted replies after a model-configuration error initially caused fallback responses to appear to be live output.

Testing also created a failure: runs changed the shared demo while I was recording. I introduced a rule that tests and resets on that shared environment required my approval.

### Boundaries of the submitted prototype

- **Synthetic data:** the salon, customers, bookings, history, network signals and partner funding are illustrative. WhatsApp is simulated inside the app.
- **Test payments:** Razorpay runs in test mode; no real money moves. The demo confirms payments through Checkout and does not establish production-ready payment reconciliation.
- **Forecasting and targeting are rules, not learned models:** the walk-in forecast and customer ranking are formulas over the synthetic data. The language model handles conversation and instructions.
- **Learning is not yet proven:** the report proposes a change to the next plan from the day's outcome, but the prototype does not yet save or apply it, and one synthetic demo day cannot show sustained improvement in forecasting, targeting or merchant revenue.
- **One shared demo:** the deployed demo runs on a single shared day, so two people using it at the same time affect each other's run.
- **Network and commercial assumptions:** access to suitable aggregated payment data, its usefulness for predicting walk-ins and owners' willingness to pay the proposed fee remain to be validated.
- **Next validation step:** a three-salon pilot would compare forecasts with logged walk-ins, test customer prepayment and owner willingness to pay, and estimate incremental revenue using a randomised holdout pooled across pilot salons.

AI helped produce and review this submission, including this log. The final decisions and responsibility for the claims are mine.

# RAY · AI build log

**Daivik John Alva | Razorpay × ISB AI PM Build Challenge | 23 September–13 October 2026**

## How I used AI

I used AI extensively for research, coding, debugging and reviewing my work. The product idea, merchant focus and business logic were mine. I decided what RAY should do, supplied the constraints and reviewed the result through walkthroughs. AI translated that direction into code, raised contradictions and suggested alternatives for me to evaluate. I made the final calls on scope, behaviour and what went into the submission.

My workflow was to describe the behaviour I wanted, ask AI to challenge it, review the implementation, and test it against the intended journey. I did not review every generated line of code manually. I relied on code reviews, tests and my own walkthroughs, which also caught mistakes the AI had missed.

## Tools and their roles

| Tool | How I used it |
| --- | --- |
| Claude / Claude Code | Research and PRD support, implementation, database setup, debugging, code review, test scripts and build-log maintenance. It wrote most of the prototype code from my requirements and subsequent feedback. |
| Claude Design | Where I made the visual mockups for the prototype, including the Strand & Co. logo and opening screen and the screen designs I annotated with changes. I gave these to Claude Code as the reference to build from. |
| ChatGPT / Codex | Stress-tested the product logic and report calculations, checked the product note against the challenge brief, researched supporting claims, generated report mockups and interactive HTML, and helped edit the submission material and this log. |
| Qwen on Cerebras | The model inside RAY. It interprets the owner's instructions, generates customer replies and answers “Ask RAY” questions. Its proposed actions are checked against rules in code. |
| ElevenLabs | Generated RAY's voice clips, which are stored and replayed to avoid generating the same line repeatedly. |

The supporting stack was Next.js, Supabase, Vercel and Razorpay test mode. Supabase held the data, live updates and saved voice clips; Vercel hosted the app; Razorpay supplied test orders, Checkout and refund APIs. These were implementation services, separate from the AI tools used to build the product.

## Decisions I owned

- **The problem and merchant:** filling unsold appointment capacity, starting with mid-size salons. I chose this segment and the problem the agent would solve.
- **The product logic:** forecast walk-ins, choose which time to release, target suitable customers, and collect payment to secure the booking. I set the boundaries around discounts, approval and customer contact.
- **The trust design:** offers in the salon's name, signed by the receptionist, with a way to call the front desk. My conversations with customers informed this choice.
- **The commercial hypothesis:** an 8% success fee on bookings RAY sells, to be tested. I chose to show both bank-funded and brand-funded offers as illustrative partnerships.
- **The experience and scope:** the chair board as the main visual, a guided daily journey, a report focused on the merchant's gain and offer spend, and a clear separation between live interaction and scripted demo behaviour.

## Build record

| Date | What I directed or decided | What AI researched, implemented or checked |
| --- | --- | --- |
| **23 Sep–1 Oct: building out the PRD** | I did the primary research (conversations with salon customers and owners) and secondary research on the market and existing tools, ideated on the problem and the solution, and tested Razorpay's existing agents to see what they already do and where the gap is. I chose the problem, the merchant segment and the product logic, and wrote the PRD. | Claude supported the secondary research, challenged the ideas and the assumptions behind them, and helped structure and draft the PRD from my direction. |
| **2–9 Oct: specification and data** | Through the week I turned the PRD into a build specification: the build order, the data model, the agent specs and the synthetic data the demo day needed, with target numbers so the prototype would tell one coherent story. I chose a separate database project so resetting the demo could not affect other work. | Claude helped draft and pressure-test the specification. When the build started on 9 Oct, Claude Code identified conflicts in wave sizes, customer counts, walk-in reservations and price-floor storage. It created the schema and reproducible synthetic data: 60 customers, 90 days of history and nearby payment activity. |
| **2–9 Oct: core flow** | Over the same week I worked out the core flow and its screens: the chair board and the offer-to-payment journey came first. I chose a simulated WhatsApp interface to avoid API setup risk, while keeping customer text input and Razorpay test Checkout functional. Prices, permitted times and floors had to be enforced in code. | On 9 Oct, Claude Code implemented the forecast, customer ranking, structured Qwen actions, live board updates and payment flow. It wrote the transaction logic for resolving competing payments and overlapping offers. |
| **9 Oct: interface review** | I rejected the first interface as too generic. I wanted a familiar salon workspace, staff columns, a live customer conversation and one clear focus at each stage. Changing a plan had to remain separate from approving it. | AI examined salon-software layouts, rebuilt the screens from my references and feedback, and corrected cases where a price change incorrectly triggered sending. |
| **9–10 Oct: live versus scripted behaviour** | I kept a scripted fallback for recording, but required the default agent path to use the live model. Voice should start when requested, and unnecessary model and voice calls should stop. | Claude Code discovered that an incorrect model configuration caused calls to fail and scripted replies to appear instead. It corrected the configuration, labelled reply sources and added controls for voice and restarting the demo. |
| **10 Oct: visual direction and change control** | I chose the Strand & Co. identity and made the logo and opening-screen mockups in Claude Design. I chose green for sold slots and staff roles instead of unfamiliar names. I required changes to go through branches, saved working versions and a demo-day test. | Claude Code built the screens from my mockups, applied the design changes and implemented the testing routine. |
| **10–11 Oct: daily report** | I defined the questions the report should answer: what the agent added, what it cost, budget usage and what happens next. I rejected colours and layouts that did not fit the prototype and selected the direction to implement. | ChatGPT stress-tested the arithmetic, attribution, capacity units, fee treatment and budget reservations. It generated visual and interactive alternatives. Claude Code integrated the selected report design. The HTML exports needed rework, so this was not a one-pass result. |
| **11 Oct: offers and payment behaviour** | I added an illustrative brand-funded offer alongside the bank offer. I changed bring-a-friend checkout to one payment for both appointments. I required the price to fall only when the customer raised price. | Claude Code implemented offer eligibility and combined checkout. When a run finished ₹60 short, it traced the difference to an unsolicited model discount and added the enforcement rule and a failing test condition. |
| **11–12 Oct: walkthrough fixes** | I supplied review notes and chose which issues to fix. These included repeated start prompts, unclear names, unexplained time changes and confusing customer-paid versus salon-received amounts. I also specified a guided tour that could be turned off for recording. | Claude Code checked feedback against the current build, fixed reproducible issues and implemented the tour. It also fixed a simulated buyer taking a customer's slot when the demo advanced before payment. |
| **12 Oct: scope and deployment** | I removed agent-to-agent negotiation because it distracted from the main journey. I required consistent revenue labels and figures, and chose to record the deployed app. | Claude Code removed the extra flow, checked the journey with the tour on and off, addressed a flagged Next.js version and diagnosed latency caused by the app server and database being in different regions. It moved the server region to match the database. |
| **12–13 Oct: submission review** | I reviewed the proposed edits and chose the final wording, metric and disclosures. I retained merchant incremental revenue as the north star because the product's purpose is to improve the owner's earnings. | ChatGPT compared the note with the challenge brief and BTC handbook, checked selected claims, flagged unsupported certainty, and suggested clearer wording. It helped distinguish simulated results from measured merchant impact and structure this build log. |

## Where AI helped, and where it needed supervision

AI let me move from a requirement to a working version quickly enough to spend time testing the actual journey. It handled the volume of implementation across the database, payments, agents, voice and interface. Using a separate AI conversation to review the report and product note also surfaced questions that were easy to miss while building, such as double-counting discounts and confusing booking counts with chair-time.

I have not measured a “10×” productivity gain. The practical benefit was the number of implementation and review cycles I could complete during the build.

There were real failures. Scripted replies were initially reported as live model responses. A model offered an unnecessary discount. Generated HTML needed correction. Test runs changed shared demo state while I was recording, and a cleanup command stopped my local server. I responded with explicit reply-source labels, code-enforced pricing, stronger checks and a rule that tests or resets on the shared demo required my approval.

## Prototype boundaries

The salon, customers, booking history, network signals and partner funding are synthetic. WhatsApp is simulated inside the app. Razorpay transactions use test mode; no real money moves. The partner examples demonstrate the proposed funding model, not commercial agreements.

The payment implementation changed during the build: earlier work included webhooks, while the final deployment notes record Checkout confirmation as the demo path, without completing the deployed webhook setup. This is a demo limitation, not a claim of production-ready payment reconciliation.

The demo illustrates the proposed learning loop. It does not establish real merchant uplift or prove that the forecasting and targeting policies improve over time. Those claims need a pilot with real outcomes and a control group.

# RAY · AI build log

**Daivik John Alva | Razorpay × ISB AI PM Build Challenge**

## How AI multiplied my output

I chose the problem, merchant segment, business logic and scope. AI helped research those choices, challenged the assumptions, and wrote most of the code. That gave me more time to walk through the product, reject weak implementations and refine the experience.

Starting from the PRD and specification I had developed, I used AI to build and revise a deployed prototype covering planning, customer selection, conversation, payment and reporting. During the build, I also changed the interface, redesigned the report, simplified group payments and removed a feature that distracted from the main journey.

### Output in numbers

| Evidence from the build | How AI increased my output |
| --- | --- |
| **4 days of implementation and iteration** | Claude Code translated my requirements into working versions across the interface, backend and integrations, allowing me to review behaviour throughout the build. |
| **11 core database tables plus a demo-state table** | AI wrote the schema and seed generator rather than requiring me to create and populate each table manually. |
| **60 synthetic customers and 90 days of booking history** | A reproducible generator covered due, lapsed, regular, VIP, opted-out and other customer types, so I could test targeting and repeat the demo consistently. |
| **4 stages in the main journey** | Morning plan, customer selection, live sales and day report were implemented as one guided flow, with a **10-step optional tour** for judges. |
| **2 illustrative funding types** | Bank-funded and brand-funded offers used different eligibility rules. AI implemented those rules from the behaviour I specified. |
| **1 checkout for 2 appointments** | After I rejected separate payments for a customer and her guest, AI changed the payment flow while retaining both bookings. |
| **A ₹60 discrepancy traced to model behaviour** | AI helped identify an unsolicited discount, then implemented my rule that price should only fall when the customer raises price. The demo test was updated to flag regressions. |

These are counts and outcomes recorded during the project. They demonstrate the amount of work completed with AI; I did not run a timed manual comparison to establish an exact 10× speedup.

## Where the acceleration came from

| Workstream | My direction and decisions | AI's work | What this enabled |
| --- | --- | --- | --- |
| **Research and specification** | I conducted customer and owner conversations, explored the opportunity, tried Razorpay's existing agents and chose the salon use case. I set the product logic and demo requirements. | Claude supported secondary research and helped structure and stress-test the PRD. It raised inconsistencies in customer counts, outreach waves, walk-in reservations and price-floor storage. | I could compare evidence and resolve implementation questions before they became rework in the app. |
| **Core implementation** | I prioritised the chair board and offer-to-payment journey. I chose a simulated WhatsApp interface, functional text input and Razorpay test Checkout. I required prices, floors and permitted times to be enforced in code. | Claude Code implemented the schema, synthetic data, forecast, ranking, structured model actions, board updates and payment flow. | One build covered the interface, database and agent behaviour, giving me a complete journey to test early. |
| **Design and iteration** | I rejected the first interface as too generic, chose the Strand & Co. identity and staff-column calendar, and specified one focus per stage. I defined the questions the daily report should answer. | Claude Design helped produce visual references. ChatGPT generated report mockups and interactive HTML; Claude Code implemented the selected direction and my annotations. | I could review concrete alternatives, then revise layout and interaction without manually rebuilding each version. Some HTML exports needed correction. |
| **Testing and correction** | I supplied walkthrough feedback and acceptance rules. A plan edit must not approve sending; simulated buyers must not take the live customer's slot; discounts must follow my price rules. I chose which review findings to fix. | Claude Code traced failures, changed the implementation and wrote repeatable demo checks. ChatGPT separately checked report arithmetic, revenue attribution, budget reservations and capacity units. | Reviews covered both software behaviour and whether the numbers made sense. A scripted test turned repeated walkthrough requirements into a reusable check. |
| **Scope and deployment** | I cut agent-to-agent negotiation, retained the core salon journey and chose to record the deployed app. | Claude Code removed the extra flow, ran the journey with the tour on and off, addressed a flagged framework version and diagnosed deployment latency. | I could simplify and stabilise the submission rather than spending the final day only on setup and debugging. |
| **Submission review** | I selected the final claims, metric and wording. I retained incremental merchant revenue as the north star because that is the value I wanted RAY to deliver. | ChatGPT compared the note with the challenge brief, checked selected sources, flagged unsupported certainty and helped edit the note and this log. | I got a separate review of the argument and evidence, including the distinction between synthetic demo results and proven merchant impact. |

## Tools used

- **Claude / Claude Code:** research support, specification drafting, most of the code, debugging, tests and build-log maintenance.
- **Claude Design:** visual mockups, the salon identity and annotated design references.
- **ChatGPT / Codex:** research checks, product and metric stress-testing, report mockups, interactive HTML and submission editing.
- **Qwen on Cerebras:** the model inside RAY for owner instructions, customer replies and “Ask RAY.” Its role in the product is separate from the AI assistance used to build it.
- **ElevenLabs:** generated voice clips, cached and reused instead of regenerated on every walkthrough.

The implementation stack was **Next.js, Supabase, Vercel and Razorpay test mode**. These provided the app, data, hosting and payment services.

## Decisions stayed with me

I owned the merchant focus, pay-to-lock approach, receptionist-led trust design, proposed 8% success fee and offer boundaries. My decisions also changed the build: I rejected the first UI, separated plan changes from approval, combined guest checkout, added the brand-funded example and cut agent-to-agent negotiation.

AI suggested alternatives and technical approaches. I evaluated them against my intended behaviour and made the final scope and product decisions. I did not manually inspect every generated line of code; I used walkthroughs, review feedback and repeatable tests to check the result.

That supervision mattered. A configuration error made scripted replies appear to be live model responses. A model offered an unnecessary discount. Test runs changed shared demo state while I was recording. The response was specific: label reply sources, enforce price rules in code, and require my approval before tests or resets on the shared demo. AI increased execution speed, but its output still needed checking.

## What the prototype demonstrates

The salon, customers, history, network signals and partner funding are synthetic. WhatsApp is simulated, and Razorpay uses test mode with no real money moving.

The prototype demonstrates the proposed workflow and learning loop. Actual merchant uplift and improvement in forecasts or targeting still need validation in a pilot with a control group.

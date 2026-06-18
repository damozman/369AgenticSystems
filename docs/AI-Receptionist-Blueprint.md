# 369 AI RECEPTIONIST — COMPLETE PLAN-OF-ACTION BLUEPRINT
### Wedge product for home-services businesses (roofing / HVAC / plumbing)
### Built to implement through Claude Code in VS Code, on top of your existing 369 stack
### Target: $2,000/month net, then expand into the full Digital Workforce

---

## HOW TO USE THIS DOCUMENT

This blueprint has 8 parts. Two are strategy (read once), the rest are execution.

- **Parts 1–2:** the offer + the math. Know these cold before you sell.
- **Parts 3–4:** the technical build + reusable templates. **Feed these section-by-section into Claude Code** — each build phase has a ready-to-paste prompt.
- **Parts 5–6:** sales, launch, and keeping clients (fighting churn).
- **Parts 7–8:** the 30-day timeline and the guardrails.

Work order: **build the engine once (Part 3) → land client #1 (Part 5) → that client's config becomes your template → repeat faster.**

---

# PART 1 — THE STRATEGY (THE WEDGE)

## The offer (keep it this narrow)
> *"I set up an AI receptionist that answers every call 24/7 and books the job — so you never lose work to a missed call while you're on a roof or under a sink. Done-for-you. You do nothing."*

## Why this wins right now
- The **demand is proven**: ~62% of calls to small businesses go unanswered, and ~85% of those callers never call back — they call a competitor. In home services a missed after-hours call can be a $1,000+ job.
- The **bare tool is a commodity** ($25–$49/mo DIY products exist). You are NOT selling the tool. You're selling **done-for-you setup + local trust + managed results**. That's the part owners won't do themselves.
- The market rewards **one vertical + one painful problem + outcome pricing**, not "we do everything."

## Why it's the right *first* SKU (not the full Digital Workforce)
- Easiest "yes" — the ROI math is obvious and immediate.
- Ships with only **voice + calendar + SMS**. No Dentrix, no deep PMS integration, no HIPAA.
- It's the **land** in land-and-expand. Once it's live and working, you upsell the same happy client the rest of the "digital employees" (Part 6). The wedge *becomes* the workforce.

## Vertical pick (choose ONE to start)
Default recommendation: **roofing** (it was already your planned secondary vertical, high job value, storm-driven urgency) **or HVAC/plumbing** (most constant year-round missed-call pain — burst pipes, no-AC-in-Texas-summer emergencies). Pick one. Your core is vertical-agnostic, so adding the others later is a config change, not a rebuild.

---

# PART 2 — THE MATH & TARGETS

## Per-client economics
| Item | Amount |
|---|---|
| You charge (recurring) | **$400/mo** (band $300–$500) |
| Your cost per client (voice usage) | ~$60–$80/mo |
| **Net per client** | **~$320/mo** |
| One-time setup fee | **$1,000–$2,000** (collect 50% deposit up front) |

## Two paths to $2,000/mo — run both
- **Fast cash (month 1):** 2 setups × $1,500 = **$3,000** before recurring matters → bridges daily needs.
- **Stable cash (ongoing):** 6–7 retained clients × ~$320 net = **~$2,000/mo**, every month.
- **Or skip the grind:** 2–3 *expanded* clients (Part 6 ladder) = the same $2k with far fewer logos.

## The funnel (sign ~8–10 to KEEP 6–7; early churn is 15–25%/mo)
| Stage | Weekly target (4–5 wk ramp) |
|---|---|
| Outreach touches | ~150–200 |
| → Demos booked | ~5–7 |
| → Contracts signed | ~2 |
| → Net keepers (after churn) | ~1.5 |

**Warm/local converts far better than cold.** Lead with relationships, local FB business groups, Chamber, in-person. Use cold calls/email only to top up volume.

---

# PART 3 — THE TECHNICAL BUILD (FOR CLAUDE CODE)

## 3.1 Architecture decision
**Build on a voice-AI platform, not raw telephony.** Let the platform handle the hard real-time parts (telephony, speech-to-text, text-to-speech, turn-taking, low latency). You own the brain and the plumbing.

| Layer | Tool | Role |
|---|---|---|
| Voice (real-time call) | **Vapi** or **Retell** | Answers calls, talks, calls your webhooks |
| Orchestration / backend | **Vercel** (your stack) | Webhook endpoints the voice agent calls |
| Database | **Supabase** (your stack) | Client config, call logs, leads, bookings |
| Reasoning (async) | **Anthropic API** (Haiku) **or your offline LLM** | Post-call summaries, lead scoring, follow-up drafting |
| Calendar | **Cal.com** (dev-friendly, API-first) or Google Calendar | Availability + booking |
| SMS | **Twilio** | Confirm caller + alert owner's cell |
| Email | **SendGrid** (your stack) | Owner notifications + monthly reports |
| Billing | **Stripe** | Deposits + recurring |

> **Cost tip (you're cost-conscious):** real-time voice needs low latency, so use the platform's hosted model there. But the *async* tasks — call summaries, urgency classification, drafting follow-up texts — can run on **your offline LLM** to cut API spend. Wire the backend so the reasoning step is swappable (offline LLM ↔ Haiku).

## 3.2 Repo structure (your vertical-agnostic core + per-vertical config)
```
369-receptionist/
├── core/                       # vertical-AGNOSTIC engine — build once
│   ├── webhooks/               # endpoints the voice platform calls mid-call
│   │   ├── check-availability/
│   │   ├── book-appointment/
│   │   ├── capture-lead/
│   │   └── post-call/          # summary + notify owner (runs after hangup)
│   ├── integrations/
│   │   ├── calendar.ts         # Cal.com / Google
│   │   ├── sms.ts              # Twilio
│   │   ├── email.ts            # SendGrid
│   │   └── reasoning.ts        # offline-LLM OR Anthropic (swappable)
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── config-loader.ts    # merges vertical + client config
│   └── dashboard/              # simple client-facing results page
├── verticals/                  # per-vertical templates
│   ├── roofing/
│   │   ├── config.json         # services, hours rules, emergency triage
│   │   ├── system-prompt.md    # agent persona + call flow
│   │   └── knowledge.md        # common FAQs for the trade
│   ├── hvac/
│   └── plumbing/
├── clients/                    # per-client instances (config only — no new code)
│   └── {client-id}/
│       └── config.json         # extends a vertical with THEIR specifics
└── supabase/
    └── schema.sql
```
**The point:** new client = new `clients/{id}/config.json`, not new code. That's what makes per-client time drop to 4–8 hours.

## 3.3 Database schema (Supabase)
```sql
-- clients
id, business_name, vertical, status, plan_price,
business_phone, owner_cell, owner_email,
hours_json, service_area, emergency_rules_json, created_at

-- calls
id, client_id, caller_number, started_at, duration_sec,
transcript, summary, outcome,           -- booked | message | emergency | spam
urgency,                                 -- low | normal | emergency
created_at

-- leads
id, client_id, call_id, name, phone, address,
issue, urgency, booked (bool), created_at

-- bookings
id, client_id, lead_id, start_time, service, status, created_at

-- faqs
id, client_id (nullable), vertical, question, answer
```

## 3.4 The voice agent's tools (functions it can call mid-call)
These map 1:1 to your `core/webhooks/`:
- `check_availability(date_range)` → returns open slots from calendar
- `book_appointment(name, phone, address, service, slot)` → writes booking, texts confirmation
- `capture_lead(name, phone, address, issue, urgency)` → writes lead, texts owner
- `transfer_to_human()` → for emergencies, warm-transfer to owner's cell
- (on hangup) `post_call` webhook → summary + owner notification

## 3.5 BUILD PHASES — paste these into Claude Code, in order

**Phase 1 — Backend scaffold**
> *"Create a Vercel + TypeScript project named 369-receptionist with the folder structure I'll paste. Set up a Supabase client in core/lib/supabase.ts and generate supabase/schema.sql for these tables: clients, calls, leads, bookings, faqs (schema pasted below). Add a config-loader in core/lib/config-loader.ts that deep-merges a vertical config.json with a client config.json and returns the final agent config."*

**Phase 2 — Integrations (swappable + testable)**
> *"In core/integrations, build four modules with clean interfaces and mock fallbacks so I can test without live keys: calendar.ts (Cal.com API: getAvailability, createBooking), sms.ts (Twilio: sendSms), email.ts (SendGrid: sendEmail), and reasoning.ts that exposes summarize(transcript) and classifyUrgency(transcript) with TWO backends behind a flag — a local-LLM HTTP endpoint and the Anthropic API (Haiku) — defaulting to local."*

**Phase 3 — Webhook endpoints (the agent's tools)**
> *"Build the four webhook routes in core/webhooks: check-availability, book-appointment, capture-lead, post-call. Each validates input, reads the client config by client_id, writes to Supabase, and triggers the right integration (booking → SMS confirm to caller + SMS alert to owner; capture-lead → SMS alert to owner; post-call → reasoning.summarize + SendGrid email to owner). Return JSON shaped for a Vapi/Retell function-call response."*

**Phase 4 — Voice agent config generator**
> *"Write a script that takes verticals/{vertical}/system-prompt.md + verticals/{vertical}/config.json + clients/{id}/config.json and outputs the final system prompt and the tool/function schema to register with the voice platform. The system prompt must inject: business name, services, hours, service area, emergency triage rules, and the FAQ knowledge. Include the four tools from Phase 3."*

**Phase 5 — Client dashboard (results = retention)**
> *"Build a simple dashboard page in core/dashboard that shows, per client: calls handled, leads captured, appointments booked, emergencies transferred, and estimated revenue saved (leads × avg job value from config). This is what I show clients monthly so they don't churn."*

**Phase 6 — Test harness**
> *"Create a test script that runs the 12 scenarios I'll paste against the agent config and webhooks (mocked integrations), printing pass/fail and the transcript for each. Scenarios include emergency routing, after-hours, simple FAQ, full booking, missing-info handling, and spam."*

## 3.6 Then connect the platform (manual, ~1–2 hrs)
1. Create the agent in **Vapi/Retell**, paste the generated system prompt.
2. Register the four tools, pointing them at your deployed Vercel webhook URLs.
3. Provision a phone number (or forward the client's existing line).
4. Run the Phase 6 scenarios live by calling the number.

---

# PART 4 — REUSABLE ASSETS (BUILD ONCE, USE EVERY CLIENT)

## 4.1 CLIENT DISCOVERY FORM (send this; their answers fill the config)
**Business basics**
1. Business name + main phone number
2. What services do you offer? (list)
3. Service area (zip codes / radius)
4. Business hours? After-hours policy?
5. Average job value? (for the ROI/dashboard math)

**Call handling**
6. When a new caller wants to book — should the AI book directly, or just take a message?
7. What info must we ALWAYS capture? (name, phone, address, issue, urgency…)
8. Your top 10 FAQs and the answers (hours, pricing ranges, "do you do X?", warranty, etc.)

**Emergencies (critical for home services)**
9. What counts as an emergency for you? (burst pipe, no heat/AC, active leak…)
10. For emergencies, transfer to which cell? Any after-hours emergency surcharge to quote?

**Logistics**
11. Calendar you use (Google? other?) — or should we provide booking?
12. Where do you want leads/messages sent — text, email, both? Which numbers/addresses?
13. Preferred greeting + tone (friendly, professional, brief?)

## 4.2 SYSTEM-PROMPT TEMPLATE (the agent's brain)
```
You are the virtual receptionist for {{business_name}}, a {{vertical}} company
serving {{service_area}}. Hours: {{hours}}. Speak warmly, briefly, like a sharp
front-desk pro — never robotic, never long-winded.

YOUR JOB, in priority order:
1. EMERGENCIES FIRST. If the caller describes {{emergency_rules}}, say you'll get
   them to someone right now and call transfer_to_human(). Do not try to book it.
2. BOOK THE JOB. For normal service requests, capture {{required_fields}}, then
   call check_availability() and book_appointment(). Confirm the time back to them.
3. ANSWER QUESTIONS using only the FAQ knowledge below. If you don't know, take a
   message via capture_lead() — never guess at price or policy.
4. ALWAYS capture name + callback number before the call ends.

SERVICES: {{services}}
FAQ KNOWLEDGE: {{knowledge}}
Never reveal you are an AI unless asked directly. Keep replies under ~2 sentences.
```

## 4.3 TEST SCENARIOS (run on every client before go-live)
1. Simple FAQ ("what are your hours?")
2. Full booking, all info given cleanly
3. Booking but caller omits address → agent must ask
4. After-hours non-emergency → take message, set expectation
5. **Emergency** (burst pipe / no AC) → transfer_to_human
6. Pricing question → give range from FAQ or take message, never invent
7. Angry/impatient caller → stay calm, capture, escalate
8. Background noise / mishear → confirm details back
9. Spam/robocall → end politely
10. "Are you a robot?" → honest, brief, keep helping
11. Wrong number / out of service area → inform, capture anyway
12. Caller wants the owner directly → take message + set callback expectation

## 4.4 ONBOARDING CHECKLIST (per client)
- [ ] Discovery form returned
- [ ] `clients/{id}/config.json` generated
- [ ] Phone number provisioned / forwarding set
- [ ] Calendar connected + booking tested
- [ ] SMS alerts to owner tested (lead + emergency)
- [ ] All 12 scenarios passed
- [ ] Owner demo + sign-off
- [ ] Go-live (route real calls)
- [ ] Day-1 + Day-2 monitoring
- [ ] Dashboard link sent to owner

---

# PART 5 — SALES & LAUNCH

## 5.1 Where to find clients (warm-first)
- People you already know who own/run a local business → direct messages
- Fort Worth / DFW Facebook business + trade groups; local Chamber; BNI / networking
- Google Maps: list 200+ home-services businesses; **call each during business hours and note which go to voicemail** — those are your hottest prospects (they're literally losing the call right now)
- Cold email/calls only to top up volume

## 5.2 The pitch (lead with the loss, not the tech)
> *"Quick question — when you're on a job and the phone rings, what happens to that call? … Most [roofers/HVAC/plumbers] lose 1–2 jobs a week to voicemail. I set up an AI receptionist that answers every call 24/7 and books the job for you. Want to hear it answer your own line on a quick demo?"*

## 5.3 Demo → close
- Build a quick demo agent on THEIR business info (live demos close ~3x better).
- Price on the call: **setup $1,000–$2,000 (50% deposit today) + $400/mo.**
- Frame ROI: "One saved job a month more than covers this."
- First 1–2 clients: offer a discounted/2-week pilot in exchange for a testimonial to break the no-case-study barrier.

## 5.4 Contracts
Reuse your **369 MSA + SOW** — strip the HIPAA BAA (not needed for home services) and simplify. Stripe for the deposit + recurring.

## 5.5 Work split (2 people)
| Partner A — Sales | Partner B — Build (the dev) |
|---|---|
| Outreach, demos, closing | Builds the core (Part 3), once |
| Billing / deposits / comms | Per-client config + testing |
| Monthly check-ins | Maintenance (minimal) + offline-LLM tasks |
| | Runs gig cash-floor in gaps until recurring stacks |

---

# PART 6 — OPERATIONS & RETENTION (BEAT THE 15–25% CHURN)

## 6.1 Retention = proof of results
- Send a **monthly one-pager** from the dashboard: calls handled, leads captured, jobs booked, emergencies caught, **estimated revenue saved.**
- A client who sees "$6,400 in jobs you'd have missed" does not cancel a $400 bill.

## 6.2 THE EXPANSION LADder (turn the wedge into the Digital Workforce)
Upsell the SAME happy client, one employee at a time:
| Add-on | Monthly add |
|---|---|
| 1. Receptionist (live) | $400 |
| 2. + Booking / scheduling | +$150–$300 |
| 3. + Missed-lead follow-up & reactivation | +$200–$400 |
| 4. + Review requests after each job | +$100–$200 |
| 5. + Intake / quoting | +$200–$400 |

One fully-expanded client = **$1,000–$1,500/mo** → **2–3 of them = your $2k**, and you've effectively deployed a Digital Workforce built from revenue.

---

# PART 7 — 30-DAY EXECUTION TIMELINE

**Days 1–5 — Build the engine + load the funnel**
- Partner B: Phases 1–4 in Claude Code; provision a test number; pass scenarios.
- Partner A: pick the vertical; build the prospect list; send 20–30 warm messages; join local groups.
- Partner B (gaps): start gig cash-floor for daily needs.

**Days 6–12 — First demos + first deposit**
- Partner B: finish Phases 5–6 (dashboard + tests); build a demo agent on a real prospect.
- Partner A: 80–100 calls/day to voicemail-prone businesses + warm follow-ups; book 5–7 demos; close the **first 50% deposit.**

**Days 13–21 — Deliver client #1 (this is your template)**
- Both: onboard client #1 end-to-end; go live; collect balance + start recurring.
- Capture results for the case study. Client #1's config becomes the reusable template.

**Days 22–30 — Stack clients + start expanding**
- Sign clients #2–4 (now faster — 4–8 hrs each).
- Send client #1 their first results report; pitch ladder step #2.
- Target: **6–7 keepers OR 2–3 expanded clients = $2,000/mo net.** Taper gig work as recurring covers the bills.

---

# PART 8 — RISKS & GUARDRAILS

- **No method is 90% guaranteed.** Odds are highest when you stay narrow (one vertical, one offer), price done-for-you (not DIY), front-load deposits, and keep selling while you deliver.
- **Churn is structural, not failure** — budget to replace ~1 in 5 early clients/month; the monthly results report is your #1 defense.
- **Emergency routing is the make-or-break feature** in home services — test it relentlessly before go-live. A mishandled burst-pipe call loses the client.
- **Quote real prices.** Never let the agent invent pricing or policy; "take a message" beats a wrong answer.
- **Legal/admin:** Texas LLC (no state income tax), CAN-SPAM for email, mind DNC rules for cold calls, set aside ~25–30% for self-employment tax.
- **Keep the gig floor** until recurring reliably clears $500/week — it removes the desperation that makes you cave on cheap, churn-prone deals.
- **Verify tool prices before committing**; avoid annual lock-ins until revenue is proven.

---

*This wedge reuses your existing 369 vertical-agnostic core, SendGrid, Supabase, Vercel, and Anthropic stack — and skips Dentrix entirely. Dental stays your higher-value flagship for later; home-services receptionist is how you get to revenue in weeks and fund the rest.*

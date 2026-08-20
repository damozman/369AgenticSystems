# Onboarding Questionnaire + Knowledge Base Integration Plan

> # ⚠ STALE — DO NOT TRUST THIS FOR CURRENT STATE
> **Last genuinely maintained 2026-07-16. Kept as a dated historical record of why things were
> built the way they were — not as a description of the system as it stands.**
>
> Known-wrong claims below include: Gumloop as a live integration (**cancelled**, account dies
> 2026-09-02), a **$1,500 setup fee** (`SETUP_FEE` has been **0** since 2026-07-17), and dental's
> template agent not existing (it does; the id typo is fixed). Nothing below mentions Google
> Calendar booking, per-item rental inventory, usage metering and billing, provisioning
> idempotency, AI disclosure, SMS consent, or A2P — all of which shipped after it was written.
>
> **For what is actually deliverable today, read `WHAT-CAN-I-DELIVER-TODAY.md` in this folder.**
> For current working state, read the Session Handoff section at the top of `CLAUDE.md`.

**Detailed design for post-checkout client vetting → Retell agent context**

Last updated: 2026-07-11 | Status: **SUPERSEDED 2026-07-13, fully built and verified — historical planning record, no open to-dos.** Re-checked 2026-07-16: every file this doc describes still exists and does what the correction note below says. See note below for what actually shipped.

> **2026-07-13:** This doc got built roughly as planned, but Part 4.6's Retell KB
> API (`POST /v2/agents/{agent_id}/knowledge-base`) doesn't exist — it was never
> a real Retell endpoint. That wrong endpoint got implemented verbatim in
> `lib/retell-kb-sync.ts` and 404'd on every single questionnaire submission
> since it was built, undetected until a real signup was tested end-to-end.
> Lesson: this doc was never checked against the actual retell-sdk before being
> implemented from — a planning doc's confidence isn't the same as a verified
> API contract.
>
> **What actually shipped instead (simpler than this whole doc):** each client
> now gets their own real LLM clone at provisioning time (not a shared
> template), so there's no knowledge-base API involved at all — the
> questionnaire's answers just merge directly into that client's own
> `general_prompt` via `client.llm.update()`, idempotently (a marker-delimited
> section gets replaced on re-sync, not duplicated). Same trigger points (form
> submit + cron retry), same `client_questionnaires` schema, same
> `questionnaireToKB()` transform (Part 4.2's structure, reused unchanged) —
> just a different, real destination for the output. See
> `lib/retell-kb-sync.ts` and `retell_provisioning_gaps_2026-07-13.md` (memory)
> for the actual implementation. Parts 1–3 and 4.1–4.2 of this doc (the
> questionnaire form, its fields, and the KB-entry structure) are still
> accurate — only Part 4.6's API contract and the "Knowledge Base" framing in
> Parts 4.1–4.4 are wrong.

---

## OVERVIEW

After a customer completes checkout:
1. **Day 0:** They receive an email with a questionnaire link
2. **Day 0-1:** They fill it out (5-10 min form)
3. **Day 1:** Their questionnaire answers get uploaded into their Retell agent's **Knowledge Base**
4. **Day 1 onward:** Every incoming call, the agent automatically searches the KB for context

Result: Agent knows their business without you vetting manually. You can iterate/tweak after launch.

---

## PART 3: POST-CHECKOUT QUESTIONNAIRE FORM

### 3.1 What is it?

A simple web form that customers fill out after paying. Captures business context so the agent can be smarter.

**Format:** Single-page form, 5-10 fields, ~5 min to complete
**Timing:** Email link sent in welcome email (day 0)
**Storage:** Supabase `client_questionnaires` table
**Access:** Linked to their `client_domain` (ties form response to their subscription)

---

### 3.2 Why these questions matter

Each question serves a purpose:

| Question | Why | Example | Agent uses it for |
|---|---|---|---|
| **What's your main pain point right now?** | Root cause of signing up | "We lose 3 jobs/week to missed calls" | Tone: sympathetic, proactive offer of help |
| **What types of work do you do?** | Vertical context | Roofing: "residential storm, commercial" | Knows what to ask caller about |
| **What's your typical job value?** | Urgency calibration | "$2,500 average" | Knows emergency roof leaks = big money, act fast |
| **Do you offer emergency services?** | Dispatch logic | "24/7 emergency calls" | If caller says emergency, prioritizes urgently |
| **Who should emergency calls go to?** | Routing | "Bob (owner) +1-555-1234, after hours" | Can offer direct connection for true emergencies |
| **What's your usual response time?** | Set expectations | "Same-day estimates, 48-hr jobs" | "I'll make sure we get back to you by [tomorrow/Friday]" |
| **Common objections you hear?** | Preemptive answers | "Price too high, timeline too long" | If caller hesitates: "Most clients save $$$ on our bulk approach..." |
| **Any specific jargon/terminology?** | Language matching | "We call them 'hail claims' not 'storm damage'" | Sounds like an insider, not an AI |
| **Best time to reach decision makers?** | Scheduling | "Bob available mornings, Sarah 2-5pm" | "Let me get Bob on the line — he's usually available mornings" |

---

### 3.3 The form itself

**Where it lives:** New route `app/onboarding/questionnaire/[domain]` 
- Access token in email link validates the domain
- Auto-fills business name from subscription

**Fields (in order):**

```
SECTION 1: Business Basics (prefilled where possible)
[ ] Business Name (prefilled from Stripe)
[ ] Your Role (text input: "Owner", "Operations Manager", etc)

SECTION 2: Your Service
[ ] What's your main pain point right now? (textarea, 200 char max)
[ ] What types of services/work do you offer? (textarea, 200 char max)
  Example: "Residential roofing, storm damage restoration, emergency repairs"
[ ] What's your average job/contract value? (select dropdown)
  - $500–$2,000
  - $2,000–$5,000
  - $5,000–$10,000
  - $10,000+
  
SECTION 3: Operations
[ ] Do you handle emergency/after-hours calls? (toggle: Yes/No)
[ ] Who should emergency calls go to? (text: name + phone)
  Example: "Bob Johnson +1-555-0123"
[ ] What's your typical response time to quotes/callbacks? (select)
  - Same-day
  - Next-day
  - 2-3 days
  - Custom: _____

SECTION 4: Help the Agent Sound Like You
[ ] What objections do callers raise most? (textarea, 200 char)
  Example: "Price too high, timeline too long, wants guarantee"
[ ] Any specific jargon or terminology we should know? (textarea, 200 char)
  Example: "We say 'hail claim' not 'storm damage'; '3-tab vs architectural shingles'"
[ ] Anything else we should know about your business? (textarea, 500 char)

BUTTON: "Save & Activate Agent"
SUCCESS MESSAGE: "✓ Your questionnaire has been saved. Your agent is now live!"
```

**Form behavior:**
- All fields optional (we want them to submit even if partial)
- No "required" fields — better to have partial data than abandoned form
- Autosave every 30 sec (localStorage backup)
- Mobile-first responsive design
- ~60 sec to complete minimum, 10 min max for comprehensive answers

---

### 3.4 Data storage in Supabase

**New table: `client_questionnaires`**

```sql
CREATE TABLE client_questionnaires (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  client_domain         TEXT        NOT NULL UNIQUE REFERENCES agent_subscriptions(client_domain),
  
  -- Form responses
  respondent_role       TEXT,       -- "Owner", "Operations Manager", etc
  pain_point            TEXT,       -- "We lose 3 jobs/week to missed calls"
  service_types         TEXT,       -- "Residential roofing, storm damage, emergency repairs"
  avg_job_value         TEXT,       -- "$2,000–$5,000"
  has_emergency_service BOOLEAN,
  emergency_contact     TEXT,       -- "Bob Johnson +1-555-1234"
  response_time         TEXT,       -- "Same-day"
  common_objections     TEXT,       -- "Price, timeline, warranty"
  jargon                TEXT,       -- "hail claim, 3-tab vs architectural"
  other_notes           TEXT,       -- Free-form anything else
  
  -- Metadata
  completed_at          TIMESTAMPTZ,  -- When they hit "Save"
  kb_uploaded_at        TIMESTAMPTZ   -- When we pushed to Retell KB
);
```

**Row-level security:**
- Only accessible to the authenticated user (client login)
- Can view/edit their own questionnaire

---

## PART 4: KNOWLEDGE BASE INJECTION INTO RETELL

### 4.1 What is Retell's Knowledge Base?

Retell has a **built-in vector database** (semantic search) that lets agents reference custom documents during calls.

**How it works (simplified):**
1. You upload documents/context (PDFs, text, Q&A)
2. Retell embeds them into vectors (semantic meaning)
3. During a call, agent searches the KB for relevant context
4. Agent retrieves matching documents and injects them into its response

**Example:**
- KB has: "We offer same-day estimates for residential jobs"
- Caller asks: "How fast can you get an estimate?"
- Agent searches KB → finds match → says: "For residential work, we do same-day estimates"
- Agent sounds like it KNOWS the business, not guessing

---

### 4.2 What we feed into the KB

We convert the questionnaire into **structured KB entries** (one entry per category):

```
ENTRY 1: BUSINESS CONTEXT
Title: About [Company Name]
Content:
"This is a [roofing] company specializing in [residential roofing, storm damage].
Average job value: [$2,000–$5,000].
Main pain point: [lose 3 jobs/week to missed calls].
They offer [24/7 emergency services]."

ENTRY 2: SERVICES & PRICING
Title: What we offer & pricing
Content:
"Service types: [residential roofing, commercial, emergency repairs]
Average job value: $2,000–$5,000
Response time: Same-day estimates
Emergency services: Yes, 24/7 available"

ENTRY 3: HOW TO HANDLE CALLS
Title: Caller handling & objections
Content:
"Emergency contact: Bob Johnson +1-555-1234 (available mornings)
Common objections: [Price too high, timeline too long]
How to respond: [Emphasize bulk pricing, explain fast turnaround]"

ENTRY 4: LANGUAGE & JARGON
Title: How they talk
Content:
"Use this terminology:
- Say 'hail claim' not 'storm damage'
- Say '3-tab vs architectural shingles' not 'roof types'
- Sound professional but friendly, emphasize emergency response"

ENTRY 5: ANYTHING ELSE
Title: Notes
Content:
"[Free-form other_notes from the form]"
```

---

### 4.3 How the agent uses the KB during calls

**During a call, the agent:**

1. **Caller asks:** "How fast can you send someone?"
2. **Agent searches KB** internally (you don't hear this)
3. **KB returns:** "Response time: Same-day estimates"
4. **Agent injects into prompt:** "This business offers same-day estimates. They specialize in residential roofing."
5. **Agent responds:** "We do same-day estimates for residential work. What's the scope of damage you're dealing with?"

**The KB is invisible to the caller** — they just hear an agent that knows the business.

---

### 4.4 Implementation flow

**Sequence diagram:**

```
Day 0: Checkout
  ↓
Customer receives welcome email + questionnaire link
  ↓
Day 0-1: Customer fills form
  ↓
Form submitted → Saved to Supabase client_questionnaires table
  ↓
Day 1: Scheduled job runs (cron or webhook trigger)
  ↓
Read questionnaire from Supabase
  ↓
Transform questionnaire into KB entries (structured text)
  ↓
Call Retell API: agent.updateKnowledgeBase(entries)
  ↓
KB uploaded, agent config updated with KB references
  ↓
marked: kb_uploaded_at timestamp in Supabase
  ↓
Next incoming call: agent searches KB automatically
```

---

### 4.5 Code locations (2026-07-16: all built and verified, re-checked directly against the real files)

| What | Where | Status |
|---|---|---|
| Questionnaire form React component | `app/onboarding/questionnaire/[domain]/page.tsx` | ✅ Built |
| Form submission API | `app/api/questionnaire/submit` | ✅ Built — awaits the sync (was fire-and-forget, fixed 2026-07-13) |
| Questionnaire → transform | `lib/questionnaire-to-kb.ts` (`questionnaireToKB()`) | ✅ Built, confirmed still imported and used |
| Merge into agent's real LLM prompt | `lib/retell-kb-sync.ts` (`syncQuestionnaireToKB()`) | ✅ Built — not a KB upload (see correction note above), merges into `general_prompt` idempotently |
| Cron retry (safety net, not the primary trigger) | `app/api/cron/sync-questionnaire-kb` | ✅ Built, confirmed still calls the real sync function for any questionnaire with `completed_at` set but `kb_uploaded_at` still null |
| Supabase schema | `supabase/schema.sql` (`client_questionnaires` table) | ✅ Built |

---

### 4.6 Retell KB API overview

**Retell's Knowledge Base endpoints (simplified):**

```typescript
// Fetch agent config (includes current KB)
GET /v2/get-agent?agent_id=...

// Update agent's knowledge base
POST /v2/agents/{agent_id}/knowledge-base
Body: {
  documents: [
    {
      title: "About us",
      content: "...",
      metadata: { category: "business_context" }
    },
    ...
  ]
}

// Response: agent config updated with new KB
```

**Key point:** KB is stored *per agent*, so each client's agent has its own KB populated from their questionnaire.

---

### 4.7 Edge cases & fallbacks

| Scenario | What happens |
|---|---|
| Customer doesn't fill questionnaire | Agent still works with template system prompt (generic but functional) |
| Questionnaire is incomplete | KB still uploads with partial data (better than nothing) |
| KB upload fails | Log error, retry on next cron run (agent still works without KB) |
| Customer edits questionnaire later | Re-triggers KB upload automatically |
| KB is empty/too generic | Agent defaults to template prompt (graceful degradation) |

---

## TIMELINE

**If we build all 4 steps before launch:**

- **Questionnaire form:** 2-3 hours (React form, basic styling, form validation)
- **Supabase schema + API endpoint:** 1 hour (new table, insert/update logic)
- **Questionnaire → KB transformer:** 1-2 hours (convert form data to structured entries)
- **Retell KB sync:** 1-2 hours (call Retell API, error handling, logging)
- **Testing:** 2-3 hours (E2E test: checkout → fill form → KB uploads → call answered with context)

**Total:** ~8-12 hours → 1-2 days

**Launch ready:** All 9 new clients get questionnaire → KB injection automatically.

---

## WHAT HAPPENS AFTER LAUNCH (ITERATION)

Once live, we can:
- **Monitor:** Which questionnaire fields clients actually fill out vs. skip
- **Tweak:** Remove unused fields, add new ones based on patterns
- **Refine:** Adjust KB entry structure if agent isn't using KB effectively
- **Expand:** Add more complex questionnaires per vertical (roofing vs. legal vs. SaaS)

So you're not locked in — this is v1, and data will tell us what to improve.

---

## SUMMARY TABLE

| Component | Purpose | Input | Output | Who uses it |
|---|---|---|---|---|
| **Questionnaire Form** | Capture business context | Customer fills form | Supabase rows | Next: KB transformer |
| **KB Transformer** | Convert Q&A to structured entries | Questionnaire rows | KB entry objects | Next: Retell API |
| **Retell KB Sync** | Upload KB to agent | KB entries | Agent config updated | Next: Agent during calls |
| **Retell Agent** | Answer calls with context | Incoming call + KB | Call handled w/ context | End customer (caller) |

---

## HOW THESE QUESTIONS WERE ACTUALLY RESOLVED (2026-07-16, historical record)

These 5 questions were open before the build; here's what shipped, for the record:

1. **Timing:** Immediately in the welcome email (day 0) — a "Complete Questionnaire (5 min)" CTA, plus a secondary "Access your dashboard" link for anyone who wants to explore first. Also folded into the dashboard's own onboarding checklist as a trackable step (added 2026-07-13), and now also linked directly from the real post-payment page (`/onboarding-complete`, built 2026-07-14) before the welcome email even arrives.
2. **Urgency:** Optional, exactly as this doc originally leaned — all fields optional, no hard gate. The dashboard checklist surfaces a "Complete now →" link if it's not done, rather than blocking anything.
3. **KB refresh:** Auto-refresh on edit — resubmitting the form re-triggers the sync every time, idempotently (marker-delimited replace, not append), plus the cron retry catches anything that failed.
4. **Vertical customization:** Same questionnaire form for all 9 verticals — no per-vertical question variants were built, and nothing since has surfaced a need for them.
5. **Tweak later:** Just re-fill the form — no separate "Edit Agent Instructions" page exists or was needed; the same submit endpoint handles both first-fill and edits.

No open questions remain on this feature.

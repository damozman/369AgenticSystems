# Onboarding Questionnaire + Knowledge Base Integration Plan
**Detailed design for post-checkout client vetting → Retell agent context**

Last updated: 2026-07-11 | Status: Planning (pre-build)

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

### 4.5 Code locations (what we'll build)

| What | Where | Status |
|---|---|---|
| Questionnaire form React component | `app/onboarding/questionnaire/[domain]/page.tsx` | TBD |
| Form submission API | `app/api/questionnaire/submit` | TBD |
| Questionnaire → KB transformer | `lib/questionnaire-to-kb.ts` | TBD |
| KB upload to Retell | `lib/retell-kb-sync.ts` | TBD |
| Cron trigger (or webhook) | `app/api/cron/sync-questionnaire-kb` | TBD |
| Supabase schema | `supabase/schema.sql` (new table) | TBD |

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

## OPEN QUESTIONS FOR CHRIS

Before we build, clarify:

1. **Timing of questionnaire:** 
   - Send immediately in welcome email (day 0)?
   - Or wait 24 hours so they've settled?
   - Or in a separate "onboarding checklist" page in the portal?

2. **Questionnaire urgency:**
   - Optional (nice to have)? → KB just sits empty if they skip
   - Quasi-required? → Gentle reminder if not filled in 24 hrs?

3. **KB refresh:**
   - One-time upload after checkout?
   - Or auto-refresh if they edit questionnaire later?
   - Or manual "Update Agent Context" button in portal?

4. **Vertical customization:**
   - Same questionnaire for all 9 verticals?
   - Or different questions per vertical (roofing vs. legal vs. SaaS)?

5. **What if they want to tweak their KB later?**
   - Just re-fill the questionnaire form?
   - Or separate "Edit Agent Instructions" page in portal?

---

## NEXT STEPS

Once you answer those 5 questions, I'll:
1. Design the exact form (which questions, in what order, conditional logic if any)
2. Scope the Retell API calls precisely (what fields map to what KB structure)
3. Build it all end-to-end

Sound good?

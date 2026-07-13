# Complete Testing Runbook: All 7 Priorities
## 369 Agentic Systems — Full Feature Verification

**Document Version:** 2.0  
**Date Created:** 2026-07-12  
**Testing Window:** 2026-07-13 through 2026-07-14  
**Production Deploy:** 2026-07-15  
**Tested By:** ________________  
**Signature:** ________________ Date: __________

---

## Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Priority #1: Per-Client Provisioning](#priority-1-per-client-provisioning)
3. [Priority #2: Monthly ROI Dashboard](#priority-2-monthly-roi-dashboard)
4. [Priority #3: Website Messaging](#priority-3-website-messaging)
5. [Priority #4: Elite Live Call Transfer](#priority-4-elite-live-call-transfer)
6. [Priority #5: Call Recording + Transcript Search](#priority-5-call-recording--transcript-search)
7. [Priority #6: SMS Follow-up](#priority-6-sms-follow-up)
8. [Priority #7: Admin Dashboard](#priority-7-admin-dashboard)
9. [Full End-to-End Integration Test](#full-end-to-end-integration-test)
10. [Sign-Off & Launch Approval](#sign-off--launch-approval)

---

## Pre-Testing Setup

### Environment Checklist

- [ ] **Git Status:** `git status` shows clean working directory (no uncommitted changes)
- [ ] **Branches:** On `master` branch, 20+ commits ahead of origin
- [ ] **Build:** `npm run build` completes without errors
- [ ] **TypeScript:** `npx tsc --noEmit` returns clean output (zero errors)
- [ ] **Dependencies:** `npm install` successful, node_modules up to date

### Environment Variables

Verify all required env vars are set:

```bash
# Retell (voice AI)
RETELL_API_KEY=<key>
RETELL_TEMPLATE_AGENT_ROOFING=<id>
RETELL_TEMPLATE_AGENT_HVAC=<id>
RETELL_TEMPLATE_AGENT_PLUMBING=<id>
RETELL_TEMPLATE_AGENT_LEGAL=<id>
RETELL_TEMPLATE_AGENT_REAL_ESTATE=<id>
RETELL_TEMPLATE_AGENT_INSURANCE=<id>
RETELL_TEMPLATE_AGENT_SAAS=<id>
RETELL_TEMPLATE_AGENT_WHOLESALE=<id>
RETELL_TEMPLATE_AGENT_DENTAL=<id>
RETELL_PHONE_NUMBER=<demo-number>

# Twilio (SMS)
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_FROM_NUMBER=<number>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<url>
SUPABASE_SERVICE_ROLE_KEY=<key>

# Email
RESEND_API_KEY=<key>

# Stripe
STRIPE_PUBLIC_KEY=<key>
STRIPE_SECRET_KEY=<key>
STRIPE_WEBHOOK_SECRET=<key>
```

- [ ] All vars confirmed set in `.env.local`
- [ ] No "undefined" or placeholder values

### Database Schema

Verify all migrations applied:

```sql
-- Run in Supabase SQL Editor

-- Check calls table has recording_url
SELECT column_name FROM information_schema.columns 
WHERE table_name='calls' AND column_name='recording_url';
-- Expected: recording_url (TEXT)

-- Check agent_subscriptions has new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name='agent_subscriptions' 
AND column_name IN ('owner_phone', 'sms_phone_number', 'followup_method');
-- Expected: owner_phone, sms_phone_number, followup_method

-- Check GIN index on transcript
SELECT indexname FROM pg_indexes 
WHERE tablename='calls' AND indexname LIKE '%transcript%';
-- Expected: idx_calls_transcript (or similar)
```

- [ ] recording_url column exists
- [ ] owner_phone column exists
- [ ] sms_phone_number column exists
- [ ] followup_method column exists
- [ ] GIN index on transcript exists

### Test Data Cleanup

```bash
# Start fresh (optional, only if database has stale test data)
npx supabase db reset  # Careful: this resets everything

# Or selectively clear test data:
# In Supabase SQL Editor:
DELETE FROM calls WHERE client_domain LIKE 'test-%';
DELETE FROM leads WHERE client_domain LIKE 'test-%';
DELETE FROM agent_subscriptions WHERE client_domain LIKE 'test-%';
```

- [ ] Database is clean of stale test data
- [ ] Ready to create fresh test subscriptions

### Dev Server

```bash
npm run dev
# Should start on localhost:3001
```

- [ ] Dev server running without errors
- [ ] No console errors (F12 Developer Tools)
- [ ] Can access http://localhost:3001 in browser

**Pre-Testing Status:** [ ] ALL CHECKS PASS [ ] MISSING ITEMS

---

## Priority #1: Per-Client Provisioning

**Status:** ✅ DONE 2026-07-11  
**Commits:** 1663d64  
**What:** Unique Retell agent + dedicated phone number + KB context auto-provisioned per customer

### Golden Path Test

**Setup:**
1. Navigate to Stripe checkout (or use test mode)
2. Purchase Starter tier:
   - Business: "Test Provisioning Co"
   - Email: test-provisioning@example.com
   - Phone: (your test phone for SMS)
   - Vertical: roofing

**Verify Provisioning Completed:**

```sql
-- Check agent was created
SELECT client_domain, retell_agent_id, retell_phone_number, sms_phone_number
FROM agent_subscriptions
WHERE client_domain = 'test-provisioning.example.com';
```

Expected output:
```
client_domain                          | retell_agent_id  | retell_phone_number | sms_phone_number
test-provisioning.example.com          | agt-xxxxx        | +1 (972) 555-0001   | (null - Starter)
```

- [ ] `retell_agent_id` is populated (non-null)
- [ ] `retell_phone_number` is populated with valid US phone
- [ ] `sms_phone_number` is NULL (Starter doesn't get SMS)

**Verify Agent Configuration:**

```bash
# Call the provisioned agent phone number
# Listen for: Ava's greeting (should be professional receptionist tone)
# Listen for: Correct vertical context (roofing-specific language)
```

- [ ] Agent answers the call
- [ ] Ava's voice quality is clear
- [ ] Greeting mentions "roofing" (vertical-specific)
- [ ] No errors in server logs

**Verify Phone Number is Unique:**

```sql
-- Create second test subscription
-- (Complete another Stripe purchase)

-- Check that phone numbers are different
SELECT client_domain, retell_phone_number
FROM agent_subscriptions
WHERE client_domain LIKE 'test-%'
ORDER BY created_at DESC LIMIT 2;
```

- [ ] Each subscription has different phone number
- [ ] No phone number reuse between clients

### Edge Cases

**Edge Case 1.1: Provisioning Fails (Non-Blocking)**
- Simulate Retell API failure: Set `RETELL_API_KEY = "invalid"`
- Attempt to create subscription
- Verify: Subscription creation fails with clear error message
- Document: [PASS / FAIL]

**Edge Case 1.2: Area Code Preference**
- Create subscription with preferred area code: 512 (Austin)
- Verify: `preferred_area_code = '512'`
- Verify: Allocated phone number has 512 area code
- Document: [PASS / FAIL]

**Priority #1 Status:** [ ] PASS [ ] FAIL — Notes: _______________

---

## Priority #2: Monthly ROI Dashboard

**Status:** ✅ DONE 2026-07-11  
**Commits:** e2960f2  
**What:** Automated monthly email showing revenue protected by customer (proof of value)

### Golden Path Test

**Setup:**
1. Ensure test subscriptions from Priority #1 are active
2. Place test calls to the agent phone (at least 2-3 calls):
   - Call 1: "Book an appointment" (should result in `call_outcome = 'booked'`)
   - Call 2: "Capture a lead" (should result in `call_outcome = 'captured_lead'`)
   - Call 3: "No answer" (should result in `call_outcome = 'no_answer'`)

**Verify Calls Captured:**

```sql
-- Check calls were recorded
SELECT call_id, caller_phone, call_outcome, created_at
FROM calls
WHERE client_domain = 'test-provisioning.example.com'
ORDER BY created_at DESC LIMIT 5;
```

Expected: At least 2-3 calls with outcomes (booked, captured_lead, no_answer)

- [ ] Calls table populated with test calls
- [ ] Outcomes are correct (booked/captured_lead/no_answer)
- [ ] Created timestamps are recent

**Trigger Monthly ROI Email:**

```bash
# Option 1: Wait for cron (runs 1st of month)
# Option 2: Manually trigger (if cron endpoint exposed)
curl -X POST http://localhost:3001/api/cron/send-monthly-roi-reports

# Option 3: Check if email was sent to test inbox
# (Use email service logs or Resend dashboard)
```

**Verify Email Received:**

Check email at test-provisioning@example.com for:

- [ ] Subject line: "Your 369 AI Receptionist — Monthly ROI Report"
- [ ] Shows: Total calls (3), booked (1), leads (1)
- [ ] Shows: Revenue protected calculation
  - Formula: (booked + leads) × job_value × 0.30
  - Example roofing: (1 + 1) × $2500 × 0.30 = $1500
- [ ] Shows: ROI multiplier (e.g., "3x: protect $1,500 on $400 fee")
- [ ] Email is nicely formatted HTML (not plaintext)

**Verify Dashboard Shows ROI:**

1. Log into client dashboard as test-provisioning@example.com
2. Look for ROI metric card
3. Verify: Shows revenue protected for this month

- [ ] ROI metric displays on dashboard
- [ ] Number matches email calculation
- [ ] Format is "$X,XXX protected"

### Edge Cases

**Edge Case 2.1: No Calls This Month**
- Create subscription but place ZERO calls
- Trigger ROI email
- Verify: Email still sends with "0 calls this month" message (not error)
- Document: [PASS / FAIL]

**Edge Case 2.2: Only No-Answer Calls**
- Place 5 test calls, all end with "no_answer"
- Trigger ROI email
- Verify: Email shows 0 revenue protected (correct, since no conversions)
- Document: [PASS / FAIL]

**Priority #2 Status:** [ ] PASS [ ] FAIL — Notes: _______________

---

## Priority #3: Website Messaging

**Status:** ✅ DONE 2026-07-12  
**Commits:** 36bb4d3, b801f41, 3faf286, 7646fab  
**What:** Updated agent detail pages, pricing page, cold email pages with 24-hr setup + ROI proof messaging

### Golden Path Test

**Part A: Pricing Page**

Navigate to: `http://localhost:3001/roofing/pricing`

- [ ] Page loads without errors
- [ ] Starter tier shows: "Your AI receptionist is live in 24 hours. Answer every call, capture every lead, track ROI monthly."
- [ ] Pro tier shows: "Receptionist + vertical-specific follow-up for ALL 9 industries. Auto-configured, profit-tracking included."
- [ ] Elite tier shows: "Full AI team: receptionist + follow-up + live transfers. Seamless handoff to your team when needed."
- [ ] Each tier lists ONLY real features (no "coming soon" claims)
- [ ] FAQ includes: "How long until my AI is answering calls?" → "24 hours"
- [ ] FAQ includes: "What's this monthly ROI report?" → Shows example calculation

**Part B: Agent Detail Pages**

Navigate to: `http://localhost:3001/agents/ava`

- [ ] Tagline mentions: "24-hour setup" or "live in 24 hours"
- [ ] Description mentions: "questionnaire" + "business context"
- [ ] Shows all 9 vertical deployments (roofing through dental)
- [ ] Each deployment shows: Vertical name, custom role description

Navigate to: `http://localhost:3001/agents/rex`

- [ ] Title: "Lead Follow-up Agent"
- [ ] Tagline: "Follows up smart — each vertical gets its own language"
- [ ] Shows all 9 verticals with custom messaging (e.g., "statute of limitations" for legal)
- [ ] Notes SMS is "coming in phase 2"

Navigate to: `http://localhost:3001/agents/nova`

- [ ] Title: "Appointment Confirmation"
- [ ] Tagline: "Sends warm appointment confirmations automatically"
- [ ] Notes "Reviews coming phase 2"

Navigate to: `http://localhost:3001/agents/felix`

- [ ] Title: "Conflict Check Agent (Legal Only)"
- [ ] Only shows legal deployment (not other verticals)
- [ ] Description emphasizes: "Exclusive to law firms"

Navigate to: `http://localhost:3001/agents/scout`

- [ ] Title: "Trial User Qualifier (SaaS Only)"
- [ ] Only shows SaaS deployment
- [ ] Description emphasizes: "Exclusive to SaaS"

**Part C: Cold Email Pages**

Navigate to each vertical's cold email page:

- `http://localhost:3001/roofing-leads/`
- `http://localhost:3001/hvac-leads/`
- `http://localhost:3001/plumbing-leads/`
- `http://localhost:3001/legal-automation/`
- `http://localhost:3001/real-estate-leads/`
- `http://localhost:3001/insurance-leads/`
- `http://localhost:3001/saas-optimization/`
- `http://localhost:3001/wholesale-leads/`
- `http://localhost:3001/dental-leads/`

For each page, verify:

- [ ] Agent cards show: Ava, Rex, Nova (and Felix for legal, Scout for SaaS)
- [ ] Ava tagline: "Answers 24/7, knows your business"
- [ ] Rex tagline: "Follows up smart — vertical-specific language"
- [ ] Nova tagline: "Books confirmed, customers notified"
- [ ] Section titled "Live in 24 Hours" appears before form
- [ ] "Live in 24 Hours" section has 3 columns:
  - ⚡ Unique Phone Number (with icon)
  - 🧠 Business Context (with icon)
  - 📊 Monthly ROI Report (with icon)
- [ ] "Live in 24 Hours" background uses vertical color (e.g., orange for roofing)
- [ ] Section has 2-3 lines of descriptive text

**Mobile Responsiveness Check:**

Test on mobile (browser dev tools, 390px width):

- [ ] Agent cards stack vertically (1 column)
- [ ] "Live in 24 Hours" section is readable on mobile (text not cut off)
- [ ] No horizontal scrolling
- [ ] Buttons are at least 44px tall (tap-friendly)

### Edge Cases

**Edge Case 3.1: Missing Vertical Color**
- Check if one vertical page doesn't have correct color
- Verify: Colors match CLAUDE.md palette (roofing #FF4500, etc.)
- Document: [PASS / FAIL]

**Priority #3 Status:** [ ] PASS [ ] FAIL — Notes: _______________

---

## Priority #4: Elite Live Call Transfer

**Status:** ✅ DONE 2026-07-12  
**Commits:** c19b795  
**What:** Owner's phone receives incoming calls live (30s ring, voicemail fallback)

### Golden Path Test

**Setup:**
1. Create Elite tier subscription:
   - Business: "Test Elite Transfer"
   - Email: test-elite-transfer@example.com
   - Phone: (YOUR PERSONAL PHONE — this is critical!)
   - Tier: Elite
   - Vertical: roofing

2. Verify database:
```sql
SELECT client_domain, owner_phone, retell_agent_id
FROM agent_subscriptions
WHERE client_domain = 'test-elite-transfer.example.com';
```

Expected: `owner_phone` is YOUR PHONE NUMBER

- [ ] owner_phone populated with your phone

**Test: Call Rings Your Phone**

1. Call the agent phone number (from `retell_phone_number`)
2. Listen to Ava's greeting and say something like: "I need a roof inspection"
3. After Ava qualifies you (~10-15s), your phone should ring
4. Answer it

- [ ] Your phone rings with caller ID showing agent phone
- [ ] You can talk to the caller
- [ ] Call quality is good (no audio issues)

**Test: Voicemail Fallback**

1. Call the agent phone again
2. Let Ava qualify you
3. When transfer attempts to ring your phone, DO NOT ANSWER
4. Let it ring for 30+ seconds
5. Call should drop to voicemail (not hang up abruptly)

- [ ] Call doesn't hang up on timeout
- [ ] Caller hears voicemail message (or standard VM system)
- [ ] Call ends gracefully

### Edge Cases

**Edge Case 4.1: Missing Owner Phone**
- Create Elite subscription WITHOUT providing phone
- Verify: `owner_phone` is NULL
- Call agent phone
- Verify: Lead captured but NOT transferred (graceful fallback)
- Document: [PASS / FAIL]

**Edge Case 4.2: Invalid Phone Format**
- Manually set owner_phone to "invalid123" in database
- Call agent
- Verify: Transfer fails gracefully, lead still captured
- Check server logs for error message
- Document: [PASS / FAIL]

**Edge Case 4.3: Update Transfer Phone After Signup**
- Call `/api/elite/configure-transfer` with NEW phone
- Verify: `owner_phone` updated in database
- Call agent with new phone
- Verify: Rings NEW phone (not old one)
- Document: [PASS / FAIL]

**Priority #4 Status:** [ ] PASS [ ] FAIL — Notes: _______________

---

## Priority #5: Call Recording + Transcript Search

**Status:** ✅ DONE 2026-07-12  
**Commits:** 7150eab  
**What:** Recordings stored from Retell, full-text search with play + download

### Golden Path Test

**Setup:**
1. Use the Elite subscription from Priority #4
2. Place test call to agent phone:
   - Say something distinctive: "I have blue roof damage on the north side"
   - Complete the call (book appointment or capture lead)

3. Verify database:
```sql
SELECT call_id, transcript, recording_url, call_outcome
FROM calls
WHERE client_domain = 'test-elite-transfer.example.com'
ORDER BY created_at DESC LIMIT 1;
```

Expected: `transcript` has your text, `recording_url` is a valid URL, `call_outcome` is booked or captured_lead

- [ ] transcript populated
- [ ] recording_url populated (should start with https://)
- [ ] call_outcome is correct

**Test: Search Transcript**

1. Log into dashboard as test-elite-transfer@example.com
2. Scroll to "Call Recording & Transcript Search" section
3. Search for: "blue roof"
4. Verify: Call appears in results
5. Verify: Snippet shows context with "blue roof" highlighted in yellow

- [ ] Search results show matching call
- [ ] Snippet extracts relevant text (shows context)
- [ ] Search term is highlighted in color

**Test: Play Recording**

1. In search results, click "Play Recording" button
2. Verify: Opens new tab with audio player
3. Verify: You can hear the call (Ava + caller conversation)

- [ ] Recording loads (no 404 error)
- [ ] Audio plays without errors
- [ ] Volume is audible

**Test: Download Transcript**

1. In search results, click "Export" button
2. Verify: Text file downloads (filename: `transcript-{call_id}.txt`)
3. Open file: Verify full transcript is there

- [ ] File downloads successfully
- [ ] File contains full transcript text
- [ ] Timestamp + caller info included

**Test: Filters**

1. Place 2-3 more test calls (one book, one capture lead, one no-answer)
2. Search for "roof" (should match all)
3. Filter: Outcome = "Booked" → should show only booked calls
4. Filter: Outcome = "Lead captured" → should show only captured
5. Filter: Date Range = "Last 7 days" → should work correctly

- [ ] Outcome filter works
- [ ] Date range filter works
- [ ] Filters combine correctly (outcome AND date)

### Edge Cases

**Edge Case 5.1: No Recording URL**
- Manually set recording_url to NULL for a call
- Search and find that call
- Verify: "Play Recording" button is disabled/hidden
- Verify: No error, page loads gracefully
- Document: [PASS / FAIL]

**Edge Case 5.2: Very Long Transcript**
- Make 5-minute test call with lots of talking
- Search the transcript
- Verify: Full text is searchable
- Verify: Snippet extraction doesn't crash UI
- Document: [PASS / FAIL]

**Edge Case 5.3: No Results**
- Search for: "xyz_nonexistent_word_999"
- Verify: "No results found" message displays
- Verify: No errors in console
- Document: [PASS / FAIL]

**Edge Case 5.4: Starter/Pro Can't Search**
- Create Starter subscription
- Log into dashboard
- Scroll to search section
- Verify: Message "Search available on Elite tier only"
- Verify: No search box visible (read-only)
- Document: [PASS / FAIL]

**Priority #5 Status:** [ ] PASS [ ] FAIL — Notes: _______________

---

## Priority #6: SMS Follow-up

**Status:** ✅ DONE 2026-07-12  
**Commits:** 7076e4b  
**What:** Pro/Elite get SMS phone, Rex can send via SMS or email, clients choose preference

### Golden Path Test

**Setup:**
1. Create Pro tier subscription:
   - Business: "Test Pro SMS"
   - Email: test-pro-sms@example.com
   - Phone: (YOUR PHONE for SMS — this is critical!)
   - Tier: Pro
   - Vertical: roofing

2. Verify database:
```sql
SELECT client_domain, sms_phone_number, followup_method
FROM agent_subscriptions
WHERE client_domain = 'test-pro-sms.example.com';
```

Expected: `sms_phone_number` populated, `followup_method = 'combo'`

- [ ] sms_phone_number is populated (valid US phone)
- [ ] followup_method = 'combo' (email + SMS)

**Test: SMS Follows Email**

1. Place test call to agent
2. During call, say: "My name is Chris and my phone is 555-1234"
3. Let call complete as captured lead

4. Trigger Rex sequence manually:
```bash
# Find the lead_id first:
SELECT lead_id FROM leads 
WHERE client_domain = 'test-pro-sms.example.com' 
ORDER BY created_at DESC LIMIT 1;

# Then trigger:
curl -X POST http://localhost:3001/api/rex/trigger \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "<lead_id>"}'
```

**Verify SMS Received:**

1. Check your phone for SMS from the SMS phone number
2. Message should say: "We've got your roof damage on file. A specialist will reach out shortly."
3. Also verify email arrives at test-pro-sms@example.com

- [ ] SMS arrives within 2 minutes
- [ ] SMS text is correct
- [ ] Email also arrives (combo mode)
- [ ] Both from same campaign (step 0)

**Test: Email-Only Mode**

1. Update subscription:
```sql
UPDATE agent_subscriptions
SET followup_method = 'email'
WHERE client_domain = 'test-pro-sms.example.com';
```

2. Place new test call, capture lead
3. Trigger Rex again
4. Verify: ONLY email arrives (no SMS)

- [ ] Email arrives
- [ ] NO SMS arrives (20+ sec wait to confirm)
- [ ] Preference respected

**Test: SMS-Only Mode**

1. Update subscription:
```sql
UPDATE agent_subscriptions
SET followup_method = 'sms'
WHERE client_domain = 'test-pro-sms.example.com';
```

2. Place new test call, capture lead
3. Trigger Rex again
4. Verify: ONLY SMS arrives (no email)

- [ ] SMS arrives
- [ ] NO email arrives
- [ ] Preference respected

### Edge Cases

**Edge Case 6.1: SMS Allocation Failed**
- Set `TWILIO_ACCOUNT_SID = "invalid"`
- Create new Pro subscription
- Verify: Subscription created successfully
- Verify: `sms_phone_number` is NULL
- Verify: `followup_method` defaults to 'email'
- Place call and trigger Rex
- Verify: Only email sent (graceful fallback)
- Document: [PASS / FAIL]

**Edge Case 6.2: Invalid Phone in Call**
- Place call but give invalid phone: "999" (too short)
- Trigger Rex with SMS
- Verify: Error logged but SMS doesn't crash
- Verify: Email still sends (if combo mode)
- Document: [PASS / FAIL]

**Edge Case 6.3: Starter Tier (No SMS)**
- Create Starter subscription
- Verify: `sms_phone_number` is NULL
- Verify: `followup_method` = 'email'
- Place call and trigger Rex
- Verify: Only email sent (SMS not available)
- Document: [PASS / FAIL]

**Priority #6 Status:** [ ] PASS [ ] FAIL — Notes: _______________

---

## Priority #7: Admin Dashboard

**Status:** ✅ DONE 2026-07-12  
**Commits:** b3f5cc3  
**What:** `/admin` dashboard showing business metrics across all clients

### Golden Path Test

**Setup:**
1. You should have 3+ test subscriptions now:
   - Starter (from Priority #1)
   - Pro (from Priority #6)
   - Elite (from Priority #4)

2. Each should have 2-5 test calls

3. Navigate to: `http://localhost:3001/dashboard/admin` (or `http://localhost:3001/admin`)

**Test: Dashboard Loads**

- [ ] Page loads without errors
- [ ] No console errors (F12)
- [ ] All sections render (key metrics, by tier, by vertical, top performers)

**Test: Key Metrics**

Verify the 4 large cards at top:

1. **Total Clients**: Should show 3 (Starter + Pro + Elite)
2. **Total Calls**: Should show sum of all test calls (≈9-15 total)
3. **Revenue Protected**: Should show 30-day value
   - Formula: (all booked + all captured) × job_value × 0.30
   - Example: If 6 booked + 6 captured = 12 × $2500 × 0.30 = $9000 (roofing)
4. **Monthly Recurring**: Should show $400 + $600 + $750 = $1750

- [ ] Total Clients correct
- [ ] Total Calls correct
- [ ] Revenue Protected calculated correctly
- [ ] MRR is $1750 (sum of all tier fees)

**Test: By Tier Breakdown**

Verify 3 cards (Starter, Pro, Elite):

**Starter Card:**
- [ ] Clients: 1
- [ ] Total Calls: X (from Starter subscription)
- [ ] Revenue Protected: (booked + leads) × $2500 × 0.30
- [ ] MRR: $400

**Pro Card:**
- [ ] Clients: 1
- [ ] Total Calls: X (from Pro subscription)
- [ ] Revenue Protected: (booked + leads) × $2500 × 0.30
- [ ] MRR: $600

**Elite Card:**
- [ ] Clients: 1
- [ ] Total Calls: X (from Elite subscription)
- [ ] Revenue Protected: (booked + leads) × $2500 × 0.30
- [ ] MRR: $750

**Test: Revenue by Vertical**

Verify list shows verticals sorted by revenue (highest first):

- [ ] Shows "roofing" first (if you used roofing for all tests)
- [ ] Shows correct revenue protected per vertical
- [ ] Shows correct MRR per vertical
- [ ] Numbers add up to totals

**Test: Top Performers Table**

Verify table shows top 10 clients by revenue:

- [ ] Shows client domain name
- [ ] Shows vertical
- [ ] Shows total calls
- [ ] Shows revenue protected (30-day)
- [ ] Sorted by revenue (highest first)

**Test: Churn Risk Alert** (if applicable)

If you created an inactive subscription (no calls for 7+ days):

- [ ] Appears in "Churn Risk" section
- [ ] Shows warning color (orange/red)
- [ ] Shows client name + tier + vertical + MRR
- [ ] Has explanation: "No calls in 48+ hours"

If no churn risk clients:

- [ ] Section doesn't appear (gracefully hidden)
- [ ] Or shows: "No churn risk detected"

### Edge Cases

**Edge Case 7.1: No Clients**
- Delete all test subscriptions from database
- Refresh admin dashboard
- Verify: Metrics show 0
- Verify: Page doesn't crash
- Verify: Sections gracefully hide or show "None"
- Document: [PASS / FAIL]

**Edge Case 7.2: Many Calls (Performance)**
- Bulk insert 100+ test calls into database
- Refresh admin dashboard
- Verify: Page loads within 3 seconds
- Verify: No timeout errors
- Verify: Numbers still correct
- Document: [PASS / FAIL]

**Edge Case 7.3: Dark Mode**
- Look for theme toggle (sun/moon icon)
- Click to toggle dark mode
- Verify: All elements render correctly
- Verify: Text is readable in both themes
- Verify: Good contrast
- Document: [PASS / FAIL]

**Priority #7 Status:** [ ] PASS [ ] FAIL — Notes: _______________

---

## Full End-to-End Integration Test

**Objective:** Verify entire customer lifecycle works seamlessly across all 7 priorities

### Scenario: New Elite Customer Signs Up

1. **Onboarding** (Priority #1)
   - [ ] Create Elite subscription via Stripe
   - [ ] Verify: Retell agent created
   - [ ] Verify: Unique phone allocated
   - [ ] Verify: SMS phone allocated
   - [ ] Verify: All stored in database

2. **First Call** (Priority #4 + #5)
   - [ ] Call agent phone
   - [ ] Ava qualifies you
   - [ ] Live transfer to your phone (or voicemail)
   - [ ] Call completes
   - [ ] Verify: Recording captured
   - [ ] Verify: Transcript captured
   - [ ] Verify: Call outcome recorded

3. **ROI Report** (Priority #2)
   - [ ] Place 2-3 test calls (mix of booked/leads)
   - [ ] Wait for monthly ROI email (or trigger manually)
   - [ ] Verify: Email calculates revenue correctly
   - [ ] Verify: Dashboard shows ROI metric

4. **Follow-up Sequences** (Priority #6)
   - [ ] Rex triggered for captured leads
   - [ ] Verify: SMS sent (combo mode)
   - [ ] Verify: Email sent (combo mode)
   - [ ] Verify: Both have vertical-specific language

5. **Search Calls** (Priority #5)
   - [ ] Log into client dashboard
   - [ ] Search transcript for keyword
   - [ ] Verify: Results show with snippet
   - [ ] Verify: Play recording works
   - [ ] Verify: Download transcript works

6. **Admin Visibility** (Priority #7)
   - [ ] Log into admin dashboard
   - [ ] Verify: Elite customer shows in metrics
   - [ ] Verify: Revenue protected calculated correctly
   - [ ] Verify: All calls counted
   - [ ] Verify: Top performers ranking is correct

### Integration Test Checklist

- [ ] All 7 priorities work together without conflicts
- [ ] No data inconsistencies (e.g., call counted twice)
- [ ] No errors in server logs during entire flow
- [ ] No errors in browser console
- [ ] All emails arrive as expected
- [ ] All SMS messages arrive as expected
- [ ] Dashboard metrics are accurate and consistent

**Integration Test Status:** [ ] PASS [ ] FAIL — Notes: _______________

---

## Sign-Off & Launch Approval

### Final Verification Checklist

**Code Quality:**
- [ ] TypeScript: `npx tsc --noEmit` = 0 errors
- [ ] No console errors (F12 Developer Tools)
- [ ] No server errors in logs
- [ ] All 23+ commits have clear messages
- [ ] Working directory is clean: `git status`

**Database:**
- [ ] All schema migrations applied
- [ ] All columns exist
- [ ] All indexes created
- [ ] Test data can be cleaned up

**Features:**
- [ ] #1: Provisioning works (unique phones, agents, SMS)
- [ ] #2: ROI emails send and calculate correctly
- [ ] #3: Website messaging is accurate (24-hr, ROI, all 9 verticals)
- [ ] #4: Live transfer routes calls to owner phone
- [ ] #5: Recording + transcript search fully functional
- [ ] #6: SMS sends via Twilio (email/SMS/combo)
- [ ] #7: Admin dashboard shows correct metrics

**Integration:**
- [ ] Full end-to-end test passes
- [ ] No conflicts between features
- [ ] No data inconsistencies

**Documentation:**
- [ ] This testing runbook is complete
- [ ] All issues documented in notes sections
- [ ] Rollback procedures identified (if issues found)

### Issues Found During Testing

```
Issue 1: [Description]
  Severity: [Critical / High / Medium / Low]
  Status: [BLOCKED / RESOLVED / WORKAROUND]
  Notes: [Resolution details or workaround]

Issue 2: [Description]
  Severity: [Critical / High / Medium / Low]
  Status: [BLOCKED / RESOLVED / WORKAROUND]
  Notes: [Resolution details or workaround]

[Add more as needed]
```

### Production Readiness Assessment

**Does the codebase meet production standards?**

- [ ] YES — All tests pass, no critical issues, ready to deploy
- [ ] PARTIAL — Some issues found but have workarounds, can deploy with caution
- [ ] NO — Critical issues found, do NOT deploy, needs more work

**Recommended Action:**

- [ ] APPROVE & DEPLOY (to Vercel immediately)
- [ ] APPROVE & DEPLOY WITH MONITORING (watch logs for 24 hours)
- [ ] HOLD & ITERATE (fix issues before deploying)
- [ ] REJECT & REVERT (restore to previous stable commit)

### Sign-Off

**Tester Name:** ________________  
**Date:** __________________  
**Time:** __________________  

**Signature:** ________________  

**Manager/Reviewer Name:** ________________  
**Date:** __________________  
**Signature:** ________________  

---

## Deployment Checklist (If Approved)

Once testing is approved:

```bash
# 1. Verify clean state
git status  # Should show: working tree clean

# 2. Verify all changes committed
git log --oneline -5  # Should show 20+ commits ahead of origin

# 3. Push to production (Vercel auto-deploys from master)
git push origin master

# 4. Monitor deploy in Vercel dashboard
# https://vercel.com/dashboard

# 5. Test production URLs:
# - https://369agenticsystems.com/roofing/pricing (pricing page)
# - https://369agenticsystems.com/agents/ava (agent detail)
# - https://369agenticsystems.com/dashboard/admin (admin dashboard)

# 6. Monitor logs for errors
# - Supabase logs
# - Vercel deployment logs
# - Error tracking (if configured)

# 7. Notify stakeholders
# Email: "Production deployment complete. All 7 priorities now LIVE."
```

- [ ] Push to master approved
- [ ] Vercel deploy successful
- [ ] Production URLs accessible
- [ ] No errors in logs (1-hour post-deploy window)
- [ ] Stakeholders notified

---

## Rollback Procedure (If Critical Issues Found)

If production issues arise:

```bash
# 1. Identify last stable commit
git log --oneline | head -20
# Look for: commit before this session's work

# 2. Revert to stable state
git revert <commit-hash>  # Or git reset --hard <commit-hash>

# 3. Push rollback to production
git push origin master

# 4. Vercel auto-deploys
# Monitor: https://vercel.com/dashboard

# 5. Document the issue
# Add to: docs/POST-MORTEM-<date>.md
```

---

## Document Control

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-12 | Claude | Initial comprehensive testing runbook for all 7 priorities |
| 2.0 | 2026-07-12 | Claude | Printable format, organized by priority, sign-off section |

**Distribution:**

- [ ] Printed copy for manual testing
- [ ] Digital copy in repo (docs/COMPLETE-TESTING-RUNBOOK-ALL-7-PRIORITIES.md)
- [ ] Shared with team
- [ ] Updated after each testing session

---

**END OF TESTING RUNBOOK**

Good luck with testing! 🚀


# Testing Schema: Priorities #4–7 (Elite Live Transfer + Call Recording + SMS + Admin Dashboard)

**Status:** Ready for comprehensive testing  
**Implementation Date:** 2026-07-12  
**Target Launch:** 2026-07-15  
**Tested By:** [Your name]  
**Date Tested:** [Date]

---

## Overview

This document provides a step-by-step testing checklist for all 4 new features shipped in this session:

1. **#4: Elite Live Call Transfer** — Owner's phone receives calls live (30s ring, then voicemail)
2. **#5: Elite Call Recording + Transcript Search** — Recordings + full-text search in dashboard
3. **#6: Pro SMS Follow-up** — Twilio SMS as alternative to email for Rex sequences
4. **#7: Admin Dashboard** — Business visibility across all clients

Each feature has a **golden path** (happy case), **edge cases**, and **rollback procedures**.

---

## Pre-Testing Checklist

- [ ] All env vars set (`RETELL_*`, `TWILIO_*`, `SUPABASE_*`, `RESEND_API_KEY`)
- [ ] Supabase schema migrations applied (`recording_url`, `owner_phone`, `sms_phone_number`, `followup_method`)
- [ ] TypeScript builds cleanly: `npx tsc --noEmit`
- [ ] No git uncommitted changes
- [ ] Test environment is clean (no stale data from previous test runs)

---

## Priority #4: Elite Live Call Transfer

### Overview
When an Elite customer is provisioned, their phone number is stored in `agent_subscriptions.owner_phone`. Retell's agent config includes `transfer_phone_number`, which routes incoming calls to that phone after qualification.

### Golden Path Test

**Setup:**
1. Create test Elite tier subscription (via Stripe checkout or `/api/onboard-client`)
   - Business: "Test Elite Roofing"
   - Email: test-elite-roofing@example.com
   - Phone: Your personal phone (or test phone)
   - Tier: Elite
   - Vertical: roofing

2. Verify database:
   ```sql
   SELECT client_domain, owner_phone, retell_agent_id, retell_phone_number
   FROM agent_subscriptions
   WHERE client_domain = 'test-elite-roofing.example.com';
   ```
   Expected: `owner_phone` is populated with your test phone

3. Verify Retell agent config:
   - Use `/api/debug/agent-template?vertical=roofing` to see template structure
   - Call your agent's phone number (from `retell_phone_number`)
   - Listen to: Does Ava greet you? (receptionist should answer)

**Test Case 1: Live Transfer After Qualification**
- Call the agent phone number
- Ask for a roof inspection (should trigger qualification)
- Ava should route to your personal phone after 10-15s of conversation
- Verify: Your phone rings with caller ID showing the agent phone
- Verify: You can talk to the caller directly
- Document: [PASS / FAIL + notes]

**Test Case 2: Voicemail Fallback**
- Call the agent phone again
- Let it ring until Ava routes to your phone
- Do NOT answer your phone (let it ring past 30s)
- Verify: Caller hears voicemail after ~30s timeout
- Verify: Call ends gracefully, no errors in logs
- Document: [PASS / FAIL + notes]

### Edge Cases

**Edge Case 1: Missing Owner Phone**
- Create Elite subscription WITHOUT providing owner phone
- Verify: SMS number allocation works, but transfer routing is disabled
- Call agent phone — should capture lead normally (no transfer)
- Expected: Lead captured in database (no owner phone to transfer to)
- Document: [PASS / FAIL + notes]

**Edge Case 2: Invalid Phone Number Format**
- Create Elite with phone: "123" (invalid/too short)
- Verify: Agent creation succeeds (non-blocking)
- Call agent — should work but transfers may fail silently
- Check logs for error message
- Document: [PASS / FAIL + notes]

**Edge Case 3: Update Transfer Phone After Onboarding**
- Create Elite, note the original `owner_phone`
- Call `/api/elite/configure-transfer` with NEW phone number
- Verify: `owner_phone` updated in database
- Verify: Retell agent config updated with new transfer number
- Call agent — should route to NEW phone
- Document: [PASS / FAIL + notes]

### Rollback

If live transfer fails:
1. Check `retell_provisioning.ts` — verify `transfer_phone_number` is correct field name in Retell API
2. If Retell field name is wrong: Update to correct field, re-run provisioning
3. If Twilio/phone validation fails: Remove `owner_phone` from subscriptions, disable feature temporarily
4. Revert: `git revert <commit-hash>`

---

## Priority #5: Elite Call Recording + Transcript Search

### Overview
Every call stores a `recording_url` (Retell CDN link) and `transcript` (full text). Elite clients can search transcripts by keyword and play/download recordings.

### Golden Path Test

**Setup:**
1. Ensure Elite subscription from Priority #4 is active
2. Place a test call to agent phone:
   - Say something distinctive: "I have a blue roof with storm damage on the north side"
   - Let the call complete (book an appointment or capture lead)

3. Verify database:
   ```sql
   SELECT call_id, transcript, recording_url, call_outcome
   FROM calls
   WHERE client_domain = 'test-elite-roofing.example.com'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expected: `transcript` contains your text, `recording_url` is populated, `call_outcome` is 'booked' or 'captured_lead'

**Test Case 1: Transcript Search**
- Log into client dashboard as Elite customer
- Scroll to "Call Recording & Transcript Search" section
- Search for: "blue roof"
- Verify: Call appears in results
- Verify: Snippet shows context around "blue roof"
- Verify: Snippet highlights search term in yellow
- Document: [PASS / FAIL + notes]

**Test Case 2: Play Recording**
- In search results, click "Play Recording" button
- Verify: Recording opens in new tab (audio player or Retell CDN)
- Verify: Audio plays (should hear Ava + caller conversation)
- Document: [PASS / FAIL + notes]

**Test Case 3: Download Transcript**
- In search results, click "Export" button
- Verify: Text file downloads (filename: `transcript-{call_id}.txt`)
- Verify: File contains full transcript
- Document: [PASS / FAIL + notes]

**Test Case 4: Filter by Outcome**
- Place 2-3 more test calls (one should book, one should fail, one should capture lead)
- Search for "roof" (should match all)
- Filter: Outcome = "Booked"
- Verify: Only booked calls show
- Filter: Outcome = "Lead captured"
- Verify: Only lead-captured calls show
- Document: [PASS / FAIL + notes]

**Test Case 5: Filter by Date Range**
- Search for "roof" 
- Filter: Date Range = "Last 7 days"
- Verify: Only recent calls show
- Filter: Date Range = "All time"
- Verify: All calls show
- Document: [PASS / FAIL + notes]

### Edge Cases

**Edge Case 1: No Recording URL**
- Call agent, complete call, but recording fails to generate (network issue)
- `recording_url` is NULL in database
- Search for call
- Verify: Result shows in search, but "Play Recording" button is disabled/missing
- Verify: No error, page loads gracefully
- Document: [PASS / FAIL + notes]

**Edge Case 2: Very Long Transcript**
- Make a long test call (5+ minutes of talking)
- Search the transcript
- Verify: Full text is searchable
- Verify: Snippet extraction works (doesn't blow up UI)
- Document: [PASS / FAIL + notes]

**Edge Case 3: Search With No Results**
- Search for: "xyz_nonexistent_word_12345"
- Verify: "No results found" message displays
- Verify: No errors in console
- Document: [PASS / FAIL + notes]

**Edge Case 4: Starter/Pro Can't Search**
- Create Starter tier subscription
- Log in to dashboard
- Scroll to search section
- Verify: Message "Search available on Elite tier only" displays
- Verify: No search box, read-only UI
- Document: [PASS / FAIL + notes]

### Rollback

If transcripts don't populate:
1. Check `call-received/route.ts` — verify `recording_url` is being captured from webhook
2. Test webhook manually: curl -X POST to `/api/call-received` with sample Retell payload
3. If GIN index is slow: Run `REINDEX idx_calls_transcript` in Supabase
4. Revert: `git revert <commit-hash>`

---

## Priority #6: Pro SMS Follow-up

### Overview
Pro/Elite clients get a dedicated SMS phone number during onboarding. Rex follow-up sequences can send via SMS instead of (or in addition to) email. Clients choose preference: "email", "sms", or "combo".

### Golden Path Test

**Setup:**
1. Create Pro tier subscription via Stripe
   - Business: "Test Pro Roofing"
   - Email: test-pro-roofing@example.com
   - Tier: Pro
   - Vertical: roofing

2. Verify database:
   ```sql
   SELECT client_domain, sms_phone_number, followup_method
   FROM agent_subscriptions
   WHERE client_domain = 'test-pro-roofing.example.com';
   ```
   Expected: `sms_phone_number` is populated, `followup_method` = 'combo'

3. Note the SMS phone number (should be a valid US number, e.g., +1 (972) 555-1234)

**Test Case 1: SMS Follow-up Sent**
- Place a call to the agent (roofing lead)
- Capture your phone number during call (e.g., "555-1234")
- Let the call complete (capture lead)

- In Supabase, find the lead:
  ```sql
  SELECT lead_id, caller_phone FROM leads
  WHERE client_domain = 'test-pro-roofing.example.com'
  ORDER BY created_at DESC LIMIT 1;
  ```

- Trigger Rex step 0 manually (or wait for cron):
  ```bash
  curl -X POST http://localhost:3001/api/rex/trigger \
    -H "Content-Type: application/json" \
    -d '{"lead_id": "<lead_id>"}'
  ```

- Verify: SMS arrives on your phone with message:
  - "We've got your roof damage on file. A specialist will reach out shortly."
  - (Should be from the SMS phone number noted above)

- Document: [PASS / FAIL + notes]

**Test Case 2: Email+SMS Combo**
- Verify `followup_method` is set to 'combo'
- Repeat Test Case 1
- Verify: BOTH SMS and email arrive (email to the address captured in call, SMS to phone)
- Document: [PASS / FAIL + notes]

**Test Case 3: Change Preference to Email-Only**
- Update subscription:
  ```sql
  UPDATE agent_subscriptions
  SET followup_method = 'email'
  WHERE client_domain = 'test-pro-roofing.example.com';
  ```

- Place another test call, capture lead
- Trigger Rex sequence again
- Verify: ONLY email arrives (no SMS)
- Document: [PASS / FAIL + notes]

**Test Case 4: Change Preference to SMS-Only**
- Update subscription:
  ```sql
  UPDATE agent_subscriptions
  SET followup_method = 'sms'
  WHERE client_domain = 'test-pro-roofing.example.com';
  ```

- Place another test call
- Trigger Rex sequence
- Verify: ONLY SMS arrives (no email)
- Document: [PASS / FAIL + notes]

### Edge Cases

**Edge Case 1: SMS Allocation Fails**
- Set `TWILIO_ACCOUNT_SID = "invalid"` (invalid Twilio credentials)
- Create new Pro subscription
- Verify: Subscription is created successfully (non-blocking)
- Verify: `sms_phone_number` is NULL
- Verify: `followup_method` defaults to 'email'
- Place call, trigger Rex — should send email only (graceful fallback)
- Document: [PASS / FAIL + notes]

**Edge Case 2: SMS Send Fails (Bad Phone)**
- Manually set `sms_phone_number` to invalid format: "abcd1234"
- Place call, trigger Rex with SMS
- Verify: Error logged, but sequence doesn't crash
- Verify: Email fallback still sent (if combo mode)
- Document: [PASS / FAIL + notes]

**Edge Case 3: Starter Tier (No SMS)**
- Create Starter tier subscription
- Verify: `sms_phone_number` is NULL
- Verify: `followup_method` = 'email' (default)
- Place call, trigger Rex
- Verify: Only email sent (SMS feature not available)
- Document: [PASS / FAIL + notes]

### Rollback

If SMS doesn't send:
1. Check Twilio env vars are set correctly
2. Test Twilio API: curl to Twilio API directly with test message
3. Check Supabase logs for failed SMS send attempts
4. If Twilio quota exhausted: Contact Twilio support
5. Temporary fix: Set `followup_method = 'email'` for all Pro clients
6. Revert: `git revert <commit-hash>`

---

## Priority #7: Admin Dashboard

### Overview
New `/admin` dashboard shows Chris (solo operator) cross-client metrics: total calls, revenue protected, clients by tier, top performers, churn risk.

### Golden Path Test

**Setup:**
1. You should have 3+ test subscriptions (Starter, Pro, Elite) from previous tests
2. Each should have 2-3 test calls
3. Navigate to: `http://localhost:3001/dashboard/admin` (or `/admin` if not nested)

**Test Case 1: Dashboard Loads**
- Verify: Page loads without errors
- Verify: No console errors (F12 developer tools)
- Verify: All sections render (key metrics, by tier, by vertical, top performers)
- Document: [PASS / FAIL + notes]

**Test Case 2: Key Metrics**
- Verify "Total Clients" shows correct count (3 in this case)
- Verify "Total Calls" shows sum of all test calls
- Verify "Revenue Protected" shows 30-day proactive value
  - Formula: (booked_calls + captured_leads) × job_value × 0.30
  - Example: roofing with 2 booked = 2 × $2500 × 0.30 = $1500
- Verify "Monthly Recurring" shows sum of all tier fees ($400 + $600 + $750 = $1750)
- Document: [PASS / FAIL + notes]

**Test Case 3: By Tier Breakdown**
- Verify Starter card shows:
  - 1 client
  - Total calls from that client
  - Revenue protected (30d)
  - MRR ($400)
- Repeat for Pro ($600) and Elite ($750)
- Document: [PASS / FAIL + notes]

**Test Case 4: Revenue by Vertical**
- Verify list shows verticals sorted by revenue (highest first)
- Should show roofing first (if you did roofing tests)
- Verify numbers match test data
- Document: [PASS / FAIL + notes]

**Test Case 5: Top Performers**
- Verify table shows calls + revenue for each client
- Verify sorted by revenue (highest first)
- Verify clicking rows doesn't break (or navigate, if implemented)
- Document: [PASS / FAIL + notes]

**Test Case 6: Churn Risk Alert**
- Create a subscription but place NO calls
- Wait 7+ days (or manually set `created_at` back 7 days in database)
- Refresh admin dashboard
- Verify: Subscription appears in "Churn Risk" section
- Verify: Orange/red warning styling
- Document: [PASS / FAIL + notes]

### Edge Cases

**Edge Case 1: No Clients**
- Delete all test subscriptions (or use fresh database)
- Load admin dashboard
- Verify: Metrics show 0, but page doesn't crash
- Verify: "Top Performers" and "Churn Risk" sections gracefully hide or show "None"
- Document: [PASS / FAIL + notes]

**Edge Case 2: One Client, Many Calls**
- Create 1 Elite subscription
- Place 50+ test calls to it (or bulk insert test data)
- Load admin dashboard
- Verify: "Total Calls" shows 50+
- Verify: No timeout/lag (queries should use indexes)
- Verify: Revenue protected calculation is correct
- Document: [PASS / FAIL + notes]

**Edge Case 3: Dark Mode**
- Load dashboard
- Click theme toggle (sun/moon icon if present)
- Verify: All elements render correctly in dark theme
- Verify: Text is readable, contrast is good
- Document: [PASS / FAIL + notes]

### Rollback

If dashboard breaks:
1. Check Supabase queries — may be missing indexes
2. Verify `agent_subscriptions` + `calls` + `leads` tables have correct schema
3. Test queries manually in Supabase SQL editor
4. If timeout: Add pagination or caching layer
5. Revert: `git revert <commit-hash>`

---

## Integration Tests (Cross-Feature)

### Test Case: Full Elite Customer Lifecycle

1. **Onboarding (Priority #4 + #5 + #6)**
   - [ ] Create Elite subscription → verify: owner_phone, sms_phone_number, retell_agent_id all populated
   - [ ] Verify Retell agent config includes `transfer_phone_number`

2. **Call Received (Priority #4 + #5)**
   - [ ] Call agent phone
   - [ ] Ava qualifies caller
   - [ ] Call transfers to owner_phone (or voicemail)
   - [ ] Retell sends webhook with `recording_url` + `transcript`

3. **Follow-up (Priority #5 + #6)**
   - [ ] Lead captured during call
   - [ ] Rex triggered manually or by cron
   - [ ] Rex step 0: Sent via SMS (because `followup_method = 'combo'`)
   - [ ] Rex step 0: Also sent via email
   - [ ] Verify both arrive

4. **Search & Playback (Priority #5)**
   - [ ] Log into dashboard
   - [ ] Search for call transcript
   - [ ] Result appears with snippet + recording link
   - [ ] Play recording, download transcript

5. **Admin Visibility (Priority #7)**
   - [ ] Log into admin dashboard
   - [ ] Verify Elite customer shows in "By Tier" (Elite section)
   - [ ] Verify revenue protected is calculated correctly
   - [ ] Verify call count includes this customer's calls

---

## Final Verification Checklist

After all tests pass:

- [ ] No errors in browser console (F12)
- [ ] No errors in server logs (`npm run dev` terminal)
- [ ] No errors in Supabase logs
- [ ] All 3 test subscriptions (Starter, Pro, Elite) have appropriate features enabled
- [ ] Admin dashboard shows correct aggregate metrics
- [ ] TypeScript still builds: `npx tsc --noEmit`
- [ ] No uncommitted changes: `git status` shows clean working directory
- [ ] All commits have clear messages: `git log --oneline -10`

---

## Sign-Off

**Tested By:** _______________  
**Date:** _______________  
**Result:** [ ] ALL PASS [ ] PARTIAL PASS [ ] FAIL  
**Notes:**

```
[Add any issues, edge cases, or observations here]
```

**Ready for Production:** [ ] YES [ ] NO (reason: _____________)

---

## Troubleshooting

### If Tests Fail

1. **Check environment variables** — ensure all `RETELL_*`, `TWILIO_*`, `SUPABASE_*` are set
2. **Check database schema** — run migrations:
   ```sql
   -- From supabase/schema.sql
   ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
   ALTER TABLE agent_subscriptions ADD COLUMN IF NOT EXISTS owner_phone TEXT;
   ALTER TABLE agent_subscriptions ADD COLUMN IF NOT EXISTS sms_phone_number TEXT;
   ALTER TABLE agent_subscriptions ADD COLUMN IF NOT EXISTS followup_method TEXT DEFAULT 'email';
   ```
3. **Check logs** — tail server logs for errors
4. **Check git status** — ensure all changes are committed
5. **Revert if needed** — `git revert <commit-hash>` if a feature breaks production

### Common Issues

| Issue | Solution |
|-------|----------|
| "owner_phone is undefined" | Schema migration not applied; run ALTER TABLE |
| "Twilio auth failed" | Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER |
| "Recording URL not captured" | Check Retell webhook payload includes recording_url |
| "SMS not sending" | Check Twilio account has credits; check phone format (+1 area code) |
| "Admin dashboard slow" | Check database indexes; add EXPLAIN ANALYZE to slow queries |
| "Transcript search returns no results" | Check GIN index was created; run REINDEX if needed |

---

## Rollout Timeline

- **Tuesday 2026-07-12:** All features implemented + merged
- **Wednesday 2026-07-13:** Full testing (use this schema)
- **Thursday 2026-07-14:** Final validation + fix any issues found
- **Friday 2026-07-15:** Deploy to production (push to Vercel from master)

# Homepage & Marketing Claims Verification Checklist

**Purpose:** Ensure every statement on every page is truthful, accurate, and backed by actual working code + deployed integrations.

**Process:** Before ANY claim appears as LIVE/ACTIVE on the site, it must pass all 5 verification steps below.

---

## 5-Step Verification Process

### Step 1: What Does This Claim Require?
List every dependency:
- Code files involved
- External services (Twilio, Retell, Stripe, Resend, etc.)
- Database schema changes
- Environment variables needed
- Configuration steps

### Step 2: Is the Code Merged and Deployed?
- [ ] Code exists in the repo (git log proof)
- [ ] Code is on `master` branch
- [ ] Code is deployed to production (Vercel)
- [ ] Git commit hash noted

### Step 3: Are External Services Configured?
- [ ] All API keys are in environment variables
- [ ] External service accounts are created and tested
- [ ] Credentials are active (not expired, not test-only)
- [ ] Service-to-service integrations are wired (e.g., Retell webhook → Supabase)

### Step 4: Has It Been Tested End-to-End?
- [ ] Feature tested with real data/real service calls
- [ ] Not just unit tests or code review
- [ ] Customer journey traced from start to finish
- [ ] Edge cases tested (off-hours, high volume, missing data, etc.)
- [ ] Tester name and date documented

### Step 5: Sign-Off
- [ ] All 4 steps above are complete
- [ ] No blockers or known issues
- [ ] Ready to tell customers this works
- [ ] Signed off by: ___________________
- [ ] Date: ___________________

---

## Systematic Word-by-Word Verification

Before approving any page, go through **every statement and every word**. For each claim:

1. **Identify the claim** (extract the exact sentence/phrase)
2. **Classify it** (feature, status, timeline, price, capability)
3. **Map dependencies** (what code/services make this true?)
4. **Run all 5 steps** (Step 1 → Step 5)
5. **Document result** (VERIFIED ✅ or NEEDS FIX ❌)

### Example Verification

**Claim:** "SMS Estimating [badge: ACTIVE]"
- **Dependencies:** Twilio API, `sendSms()` function, `allocateSmsNumber()`, Rex sequence wired to SMS
- **Code merged?** ✅ Yes (commit 7076e4b)
- **External service configured?** ❌ NO — Twilio account not set up, no credentials in env
- **End-to-end tested?** ❌ NO — Can't test without Twilio account
- **Sign-off:** ❌ BLOCKED
- **Status:** REVERT to "COMING SOON" until Twilio is configured

---

## Claims to Verify (Homepage)

### Hero Section

| Claim | Dependencies | Code Merged? | Service Configured? | Tested? | Status |
|-------|--------------|--------------|---------------------|---------|--------|
| "Deployed in 72 hours" | Retell provisioning, agent cloning, phone allocation | ✅ | ✅ (Retell API key) | ✅ Tested on demo line | ✅ VERIFIED |
| "24/7 Call Coverage" | Retell agent running 24/7 | ✅ | ✅ (Retell) | ✅ | ✅ VERIFIED |
| "8 Agentic Systems" | All 8 system cards render | ✅ | N/A (UI only) | ✅ | ✅ VERIFIED |

### System Catalog Cards

| Card | Claim | Dependencies | Status |
|------|-------|--------------|--------|
| **Legal** | "Autonomous client intake & conflict check" | Ava agent, Retell v14+, legal prompts | ✅ VERIFIED |
| **Legal** | "Consultation confirmation & lead follow-up" | Rex agent, email sequences (Resend) | ⚠️ NEEDS VERIFICATION — Email follow-ups working? |
| **Roofing** | "24/7 call intake — every storm lead answered live" | Ava agent on roofing template | ✅ VERIFIED |
| **Roofing** | "Automated estimate delivery & follow-up" | Rex agent, email templates | ⚠️ NEEDS VERIFICATION |
| **Roofing** | "SMS Estimating [ACTIVE]" | Twilio, `sendSms()`, Rex wired to SMS | ❌ NEEDS FIX — Revert to COMING SOON |
| **SaaS** | "Follow-up Specialist [ACTIVE]" | Rex agent, email sequences | ⚠️ NEEDS VERIFICATION — Is Rex actually running? |
| **Real Estate** | "Follow-up Specialist [ACTIVE]" | Rex agent, email sequences | ⚠️ NEEDS VERIFICATION |
| **Insurance** | "Follow-up Specialist [ACTIVE]" | Rex agent, email sequences | ⚠️ NEEDS VERIFICATION |
| **Wholesale** | "Follow-up Specialist [ACTIVE]" | Rex agent, email sequences | ⚠️ NEEDS VERIFICATION |

### Why 369 Section

| Claim | Dependencies | Status |
|-------|--------------|--------|
| "Zero Missed Calls" | Ava agent running 24/7, call logging | ✅ VERIFIED |
| "No Staff Overhead" | AI workforce concept (no code needed) | ✅ VERIFIED |
| "72h Rapid Deployment" | Provisioning pipeline, phone allocation | ✅ VERIFIED |
| "Purpose-built for your vertical" | 9 vertical templates, Retell agent cloning | ✅ VERIFIED |

### Pricing Page (if applicable)

| Claim | Dependencies | Status |
|-------|--------------|--------|
| "Starter: $400/mo" | Stripe billing, tier config | ? NEEDS VERIFICATION |
| "Pro: $600/mo" | Stripe billing, tier config, SMS phone allocation | ? NEEDS VERIFICATION |
| "Elite: $750/mo" | Stripe billing, tier config, live transfer, transcript search | ? NEEDS VERIFICATION |

---

## How to Use This Checklist

### Before Pushing Anything:

1. **Identify all claims** on the page you're about to change
2. **For each claim, run all 5 verification steps**
3. **Only approve claims where all 5 steps pass**
4. **Document blockers** (e.g., "SMS Estimating blocked: Twilio not configured")
5. **Update the checklist** after verification (add status, date, tester name)

### How to Prompt Claude for Verification

Instead of: *"Make sure this is truthful"*

Say: *"Verify these 5 claims using the 5-step process:*
- *Claim: [exact quote from page]*
  - *Step 1: List all dependencies (code, services, env vars)*
  - *Step 2: Confirm code is merged (show git commit)*
  - *Step 3: Confirm services are configured (credentials in env?)*
  - *Step 4: Describe the end-to-end test*
  - *Step 5: Sign off or flag as blocked"*

### Red Flags (Revert to COMING SOON Immediately)

- ❌ Code written but external service not configured
- ❌ Feature marked ACTIVE but never tested with real data
- ❌ Promise made but dependency (like SMS provider) isn't set up
- ❌ Copy says "live" but feature is controlled by a feature flag that's off
- ❌ Any claim where you answer "I'm not sure" to Step 3 or 4

---

## Template: Claim Verification Log

Use this for each claim before it goes on the page:

```
CLAIM: [exact statement from page]
STATUS: [VERIFIED ✅ | BLOCKED ❌ | PARTIAL ⚠️]

Step 1 - Dependencies:
- [ ] Code files: _________________
- [ ] External services: _________________
- [ ] Environment variables: _________________
- [ ] Database schema: _________________

Step 2 - Code Merged?
- [ ] File path: _________________
- [ ] Git commit: _________________
- [ ] Verified on master branch: _________________

Step 3 - Services Configured?
- [ ] Service: _________________ (configured? YES/NO)
- [ ] Credentials tested: _________________
- [ ] Webhook/integration wired: _________________

Step 4 - End-to-End Tested?
- [ ] Test date: _________________
- [ ] Tester: _________________
- [ ] Customer journey: _________________
- [ ] Edge cases tested: _________________
- [ ] Result: _________________

Step 5 - Sign-Off?
- [ ] All 4 steps pass: YES/NO
- [ ] Approved by: _________________
- [ ] Date: _________________
- [ ] Blockers: _________________
```

---

## Next Steps

1. **Use this checklist for every page update** going forward
2. **Before marking anything LIVE, verify it with all 5 steps**
3. **Document blockers** (don't hide them, list them)
4. **When Claude says "this is built," ask:** "Verify Step 3 and Step 4 — is it actually integrated and tested?"

This catches things like "SMS code is written but Twilio isn't set up" before they make it to the homepage.

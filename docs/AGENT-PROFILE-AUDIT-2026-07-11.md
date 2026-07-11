# Agent Profile & Card Audit & Update
**Date:** 2026-07-11  
**Scope:** Update all agent descriptions, cards, and detail pages across all 9 verticals  
**Principle:** Only claim what's actually LIVE; mark DEPLOYING accurately

---

## AGENT REALITY CHECK

### What's LIVE (Update Descriptions to Emphasize)

**Ava — AI Receptionist**
- ✅ Answers 24/7 (all verticals)
- ✅ Captures lead details (name, phone, issue, urgency)
- ✅ Books appointments (when available)
- ✅ Vertical-specific system prompt (knows roofing industry language, legal deadlines, etc.)
- ✅ Business context from questionnaire (knows YOUR pain points, services, jargon)
- ✅ Retell AI voice (HD quality in Pro/Elite)
- **Status: LIVE for all 9 verticals**

**Rex — Lead Follow-up Agent**
- ✅ 3-step email sequence (day 0, 3, 7)
- ✅ Vertical-specific messaging (legal gets deadline urgency, real-estate gets market timing, etc.)
- ✅ **NOW LIVE FOR ALL 9 VERTICALS** (previously only 3)
- ✅ Automated trigger on lead capture
- **Status: LIVE for all 9 verticals (updated 2026-07-11)**

**Nova — Appointment Confirmation & Delivery**
- ✅ Sends booking confirmations (email)
- ✅ Delivery tracking (what got sent, when)
- ❌ Review requests (NOT built yet)
- ❌ Follow-up on job completion (NOT built yet)
- **Status: DEPLOYING (partial — confirmation only, not reviews)**

**Felix — Legal Conflict Checker**
- ✅ Runs conflict checks on intake (legal firms only)
- ✅ Flags conflicts in real-time
- ❌ NOT applicable to non-legal verticals
- **Status: LIVE for legal only; N/A for others**

**Scout — SaaS Qualification Agent**
- ✅ Qualifies trial users (SaaS only)
- ✅ Asks discovery questions
- ❌ NOT applicable to non-SaaS verticals
- **Status: LIVE for SaaS only; N/A for others**

---

## AGENT CARD UPDATES (Static HTML)

### Current Issues to Fix

**Issue 1: Rex's Role Name**
```
CURRENT: "Storm Alert Agent" (roofing-specific nickname)
TRUTH:   "Lead Follow-up Agent" (works for ALL verticals now)
ACTION:  Rename Rex cards to "Lead Follow-up Agent" on ALL 9 pages
```

**Issue 2: Nova's Description Overstates**
```
CURRENT: "Confirms every booking automatically" + "Sends reviews"
TRUTH:   Confirms bookings via email; review requests not built yet
ACTION:  Change to "Sends appointment confirmations automatically"
         Remove any mention of review requests
```

**Issue 3: Felix & Scout Role Clarity**
```
CURRENT: Listed on every vertical
TRUTH:   Felix only on Legal; Scout only on SaaS
ACTION:  Only show Felix on legal-automation page
         Only show Scout on saas-optimization page
         Remove from all other verticals
```

**Issue 4: Agent Virtue/Tagline Updates**
```
Old taglines are generic. Update to reflect what's actually new:
- Ava:   "Never misses a call" → "Answers 24/7, knows your business"
- Rex:   "Fires outreach in 60 seconds" → "Follows up smart — vertical-specific language"
- Nova:  "Confirms every booking" → "Books confirmed, customers notified"
- Felix: "Spots conflicts fast" (legal only) → keep as-is
- Scout: "Asks the right questions" (saas only) → keep as-is
```

---

## AGENT DETAIL PAGES (`/agents/[agent]`)

### What to Update on Each Agent's Detail Page

**Ava (All Verticals)**
```
Add to description:
- Business Context: "Learns your pain points, services, and language from a 
  5-min questionnaire. Uses this on every call."
- Vertical Expertise: "System prompt tuned for [vertical] (e.g., 'knows storm 
  seasons', 'understands statute of limitations', 'speaks SaaS language')"
- Immediate Availability: "Unique phone number allocated within 24 hours. Live same day."
- Monthly Proof: "Monthly ROI email shows calls answered, leads captured, revenue protected"

Remove any claims about:
- "AI review requests" — not built
- "Call recording + search" — not built yet
- "Live call transfer" — not built yet
```

**Rex (All 9 Verticals)**
```
UPDATE role description from "Storm Alert Agent" to "Lead Follow-up Agent"

Add to description:
- Vertical-specific messaging: "Follow-up emails change based on industry:
  · Legal: emphasizes statute of limitations / deadline urgency
  · Real Estate: emphasizes market timing / buyer pool
  · Insurance: emphasizes coverage gaps / rate locking
  · SaaS: emphasizes time-to-value / ROI
  · [etc for all 9]"
- Now available everywhere: "Pro tier now includes Rex for ALL 9 verticals, 
  not just roofing/HVAC/plumbing"
- Automation: "Triggers automatically on lead capture. 3 emails: day 0, 3, 7"

Remove any claims about:
- "SMS follow-up" — not built yet (Twilio stub exists)
- "Custom sequences" — hard-coded per vertical, not customizable yet
```

**Nova (All Verticals, but Limited)**
```
CLARIFY: "Sends appointment confirmations, not reviews yet"

Add to description:
- What's built: "Sends email confirmations to booked customers with date/time/location"
- What's coming: "Review request automation coming in phase 2"
- Availability: "Pro and Elite tiers"

Remove any claims about:
- "Requests reviews" — not built
- "Automates follow-ups after jobs complete" — not built
- "Tracks job completion" — not built
```

**Felix (Legal Only)**
```
LOCATION: legal-automation page only
DO NOT SHOW on other verticals

Add to description:
- What it does: "Runs conflict-of-interest checks on every intake call. 
  Flags potential conflicts in real-time."
- When it runs: "Automatically during call with intake data"
- Integration: "Stores conflict check results in your dashboard"
- Availability: "Pro and Elite tiers for legal firms"

Make clear:
- "This agent is exclusive to legal practices"
```

**Scout (SaaS Only)**
```
LOCATION: saas-optimization page only
DO NOT SHOW on other verticals

Add to description:
- What it does: "Qualifies trial users during signup calls. Asks discovery questions 
  about use case, team size, timeline, budget"
- When it runs: "Automatically on inbound calls to your trial signup line"
- Integration: "Stores qualification data in your SaaS dashboard"
- Availability: "Pro and Elite tiers for SaaS companies"

Make clear:
- "This agent is exclusive to SaaS companies"
```

---

## FILE-BY-FILE UPDATE LIST

### Static HTML Pages (9 total)

**1. public/roofing-leads/index.html**
```
- Update Rex card: "Storm Alert Agent" → "Lead Follow-up Agent"
- Keep Ava, Nova, Felix, Scout visible (correct for roofing)
- Update agent taglines (see above)
- Remove any claims about features not built
```

**2. public/hvac-leads/index.html**
```
- Update Rex card: "Storm Alert Agent" → "Lead Follow-up Agent"
- Keep Ava, Nova visible
- REMOVE Felix card (legal only)
- REMOVE Scout card (saas only)
- Update agent taglines
```

**3. public/plumbing-leads/index.html**
```
- Update Rex card: "Emergency Alert Agent" → "Lead Follow-up Agent" (or similar)
- Keep Ava, Nova visible
- REMOVE Felix card
- REMOVE Scout card
- Update agent taglines
```

**4. public/legal-automation/index.html**
```
- Update Rex card: "Legal Follow-up Agent" → "Lead Follow-up Agent"
- Keep Ava, Nova, Felix visible (Felix is legal-specific)
- REMOVE Scout card (saas only)
- Add Felix description: "Exclusive to law firms"
- Update agent taglines
```

**5. public/real-estate-leads/index.html**
```
- Update Rex card: Role description emphasizes "market timing"
- Keep Ava, Nova visible
- REMOVE Felix card
- REMOVE Scout card
- Update agent taglines
```

**6. public/insurance-leads/index.html**
```
- Update Rex card: Role description emphasizes "coverage gaps"
- Keep Ava, Nova visible
- REMOVE Felix card
- REMOVE Scout card
- Update agent taglines
```

**7. public/saas-optimization/index.html**
```
- Update Rex card: Role description emphasizes "ROI acceleration"
- Keep Ava, Nova, Scout visible (Scout is saas-specific)
- REMOVE Felix card (legal only)
- Add Scout description: "Exclusive to SaaS companies"
- Update agent taglines
```

**8. public/wholesale-leads/index.html**
```
- Update Rex card: Role description emphasizes "inventory urgency"
- Keep Ava, Nova visible
- REMOVE Felix card
- REMOVE Scout card
- Update agent taglines
```

**9. public/dental-leads/index.html**
```
- Update Rex card: Role description emphasizes "patient retention"
- Keep Ava, Nova visible
- REMOVE Felix card
- REMOVE Scout card
- Update agent taglines
```

### Next.js Pages (Dynamic)

**app/agents/ava/page.tsx**
- Add "Business context from questionnaire" section
- Add "Vertical expertise" section
- Add "24-hour setup" section
- Remove false claims about features not built

**app/agents/rex/page.tsx**
- Update "Storm Alert Agent" → "Lead Follow-up Agent"
- Add detailed vertical-specific messaging examples
- Show it now works for all 9 verticals
- Remove SMS follow-up claims (not built)

**app/agents/nova/page.tsx**
- Clarify: "Sends confirmations, not reviews"
- Show what's built vs. what's coming
- Set expectations: "Review automation coming soon"

**app/agents/felix/page.tsx** (Legal only)
- Add clear: "This agent is for legal practices only"
- Explain conflict-of-interest workflow
- Link to legal-automation page

**app/agents/scout/page.tsx** (SaaS only)
- Add clear: "This agent is for SaaS companies only"
- Explain trial user qualification workflow
- Link to saas-optimization page

---

## Agent Card Component Updates

### Where it Lives
`components/agents/AgentCard.tsx` (if used on multiple pages)

### What to Change
- Remove hardcoded agent names; use data-driven approach
- Add `vertical` property to filter agents per page
- Update tagline/description text
- Ensure status badges (LIVE vs DEPLOYING) match reality

---

## TRUTHFULNESS CHECKLIST

Before deploying, verify each claim:

- [ ] "Ava answers 24/7" — ✅ TRUE (all verticals)
- [ ] "Rex follows up automatically" — ✅ TRUE (all 9 verticals)
- [ ] "Nova confirms appointments" — ✅ TRUE
- [ ] "Nova requests reviews" — ❌ FALSE (remove this)
- [ ] "Felix checks conflicts" — ✅ TRUE (legal only)
- [ ] "Scout qualifies trial users" — ✅ TRUE (saas only)
- [ ] "24-hour setup" — ✅ TRUE (now)
- [ ] "Monthly ROI email" — ✅ TRUE (all tiers)
- [ ] "Business context from questionnaire" — ✅ TRUE (new)
- [ ] "Follow-up works for all 9 verticals" — ✅ TRUE (updated)
- [ ] "SMS follow-up" — ❌ NOT BUILT (remove)
- [ ] "Call recording + search" — ❌ NOT BUILT (remove)
- [ ] "Live call transfer" — ❌ NOT BUILT (remove)
- [ ] "Review request automation" — ❌ NOT BUILT (say "coming soon")

---

## Implementation Order

1. Update agent card taglines/roles (highest impact on marketing)
2. Remove Felix & Scout from non-applicable verticals
3. Update agent detail pages (/agents/[agent])
4. Update static HTML pages (9 cold email pages)
5. Final truthfulness sweep: grep for false claims

---

## Mobile Responsiveness Checklist

All updates must work flawlessly on mobile (320px–480px viewport):

### Agent Cards
- [ ] Agent photo scales cleanly (140×175px)
- [ ] Agent name + role text doesn't wrap awkwardly
- [ ] Status badge (LIVE/DEPLOYING) visible and readable
- [ ] Tagline text stays under 90 chars to avoid wrapping on small screens
- [ ] Tap targets are 44px minimum (WCAG)
- [ ] Hover effect converts to touch-friendly (tap-and-hold visual feedback)

### Agent Detail Pages
- [ ] Hero section (photo + name + role) stacks vertically on mobile
- [ ] Feature list items are readable at small font sizes
- [ ] "View profile" links are tap-friendly (44px+)
- [ ] No horizontal scrolling
- [ ] Images scale responsively

### Cold Email Pages (Static HTML)
- [ ] Agent roster grid adapts from 4-col (desktop) → 2-col (tablet) → 1-col (mobile)
- [ ] "Meet the [Name] Roster" section is readable on all screen sizes
- [ ] Agent cards don't truncate text on mobile
- [ ] Navigation links are tap-friendly
- [ ] CTA buttons scale properly

### Testing
Before launch:
- [ ] Test on iPhone 12 (390px)
- [ ] Test on Samsung S21 (360px)
- [ ] Test on iPad (768px)
- [ ] Chrome DevTools responsive mode 320px–480px
- [ ] Check for any text overflow or layout shifts

---

## Notes

- **Tone:** Confident about what IS live, honest about what's coming
- **Language:** "Coming in phase 2" for Nova reviews, not "never" or "maybe"
- **Emphasis:** 24-hour setup, monthly ROI proof, vertical expertise
- **Consistency:** Same messaging across all pages + detail pages
- **Mobile-First:** All responsive; touch-friendly; no horizontal scroll

**Ready to implement once you approve.**

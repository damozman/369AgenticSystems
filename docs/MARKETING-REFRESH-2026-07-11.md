# Marketing Refresh — New Features & Sales Messaging
**Date:** 2026-07-11  
**Context:** Three major features now live — per-client provisioning, monthly ROI email, Rex follow-up for all 9 verticals  
**Objective:** Update all customer-facing copy to reflect new capabilities and drive conversion

---

## PART 1: Tier Descriptions & Features

### Where to Update
**File:** `lib/tier-config.ts` (lines 33–81)

### Current Problem
- Tier descriptions are generic ("Best for small crews")
- Features don't highlight the NEW capabilities (auto-setup, ROI tracking, vertical-specific follow-up)
- Pro tier doesn't emphasize follow-up is now available for ALL verticals (previously only 3)

### Recommended Updates

**STARTER ($400/mo)**
```
Current:  "Best for small crews just getting started"
New:      "Perfect for getting started — your AI receptionist is live in hours, not weeks"

Features to highlight:
✓ 24/7 AI Receptionist (instant answer, lead capture)
✓ Automatic setup (unique phone number allocated same day)
✓ Lead dashboard with real-time trending
✓ Business context KB (from onboarding questionnaire)
✓ Email booking confirmations + daily summaries
✓ Monthly ROI report (see what your AI saved you)
```

**PRO ($600/mo) — FEATURED**
```
Current:  "Best for growing companies scaling fast"
New:      "The best value — receptionist + automated follow-up across all verticals"

Features to highlight:
✓ Everything in Starter, plus:
✓ Automated 3-step follow-up sequence (vertical-specific messaging)
  - Legal: Deadline urgency
  - Real Estate: Market timing
  - Insurance: Coverage gaps
  - SaaS: ROI acceleration
  - Wholesale: Inventory pressure
  - [+ Dental, HVAC, Plumbing, Roofing copy]
✓ Follow-up now works for ALL 9 verticals (not just 3)
✓ Enhanced voice quality (clearer, more professional)
✓ Priority support
```

**ELITE ($750/mo)**
```
Current:  "Best for high-volume operations"
New:      "Full team replacement — receptionist, follow-up, and intelligence"

Features to highlight:
✓ Everything in Pro, plus:
✓ Premium voice quality (sounds indistinguishable from human)
✓ Call recording + searchable transcript library
✓ Custom Business Intelligence (caller analytics, trends, patterns)
✓ Priority onboarding & dedicated support
```

---

## PART 2: Pricing Page Copy Updates

### Where to Update
**File:** `components/verticals/VerticalPricing.tsx` (lines 12–58)

### New Urgency Angles (per vertical)

**ROOFING**
```
Current urgency:  "Roofing season is here — new client slots are filling fast."
Recommended:      "Roofing season is here. Your AI receptionist is live within 24 hours. 
                   Every missed call costs you $2,000+ in lost jobs."
```

**HVAC**
```
Current urgency:  "Summer heat rush is on — lock in your setup before slots fill."
Recommended:      "Summer heat rush hits TODAY. Your AI answers emergency calls 24/7 
                   while you sleep. Live in one day. $350+ average emergency call value."
```

**LEGAL**
```
Current urgency:  "Every hour of delay hands qualified leads to faster-responding firms."
Recommended:      "High-value cases need instant response. Your AI qualifies callers, 
                   captures details, and routes urgent matters to you within minutes.  
                   Live today. Average case value: $5,000+."
```

**REAL ESTATE**
```
Current urgency:  "Market is moving fast — agents onboarding now are closing faster."
Recommended:      "Hot buyers won't wait. Your AI answers within seconds, qualifies 
                   interest, books showings automatically. Live in hours.  
                   Average deal: $9,000+."
```

**INSURANCE**
```
Current urgency:  "Agencies responding within 5 minutes close 90% more policies."
Recommended:      "Quote requests deserve instant response. Your AI captures coverage 
                   needs, pulls quotes, books consultations. Agencies responding same-day 
                   close 3x faster. Live tomorrow. Average policy: $1,200+."
```

**SaaS**
```
Current urgency:  "Every hour before first contact drops your conversion rate."
Recommended:      "Trial users decide in minutes, not days. Your AI greets them instantly, 
                   answers setup questions, books onboarding calls. Live today.  
                   Average customer lifetime value: $2,400+."
```

**DENTAL**
```
Current urgency:  "Patient slots are limited — practices booking now for next month."
Recommended:      "Patient calls come at all hours. Your AI answers 24/7, books appointments, 
                   sends confirmations. Live in hours. Average patient value: $200+."
```

**WHOLESALE**
```
Current urgency:  "Distributors with instant response retain 40% more accounts."
Recommended:      "Order inquiries can't wait. Your AI confirms stock, takes orders, 
                   routes to fulfillment. Live today. Average order: $2,500+."
```

**PLUMBING**
```
Current urgency:  "Emergency plumbers are in high demand — don't miss another call."
Recommended:      "Burst pipes don't wait. Your AI answers emergency calls 24/7, 
                   captures job details, books technicians. Live tomorrow.  
                   Average emergency call: $400+."
```

---

## PART 3: FAQ Updates

### Where to Update
**File:** `components/verticals/VerticalPricing.tsx` (lines 60–81)

### New/Updated FAQs

```
Q: "What's included in the $1,500 setup?"
OLD: "Agent configuration for your vertical, dashboard setup, an onboarding call, 
      system prompt tuning, and full integration with your existing workflow."
NEW: "Unique phone number allocated (live same day), AI agent configured for your vertical, 
      questionnaire link sent for business context, Knowledge Base auto-populated, 
      dashboard access + onboarding call, system prompt tuning. Done in 24 hours."

Q: "How long until my AI is answering calls?"
NEW: "As little as 24 hours. We allocate your dedicated phone number, configure your agent 
      with vertical-specific settings, and send your onboarding questionnaire. Most clients 
      are live within a day. If forwarding an existing business number, add 5-7 business days 
      for carrier setup on your end."

Q: "Will the AI know about my business?"
NEW: "Yes. Right after setup, you complete a 5-minute questionnaire about your services, pain 
      points, common objections, and how you like to handle calls. We upload this to your agent's 
      Knowledge Base so it references your business context on every call."

Q: "What's this monthly ROI report?"
NEW: "On the 1st of each month, you get an email showing real numbers: calls answered, leads 
      captured, estimated revenue protected (using your vertical's average job value), and ROI 
      multiplier. Example: 'You protected $12,600 in revenue this month. Your fee was $400. ROI: 31x.' 
      It's proof that the service works."

Q: "Do I get follow-up automation?"
NEW: "Only in Pro and Elite. Pro includes automated 3-step email follow-up sequences (vertical-specific). 
      Legal gets deadline urgency, Real Estate gets market timing angles, Insurance gets coverage gap messaging. 
      Follow-up now works for ALL 9 verticals, not just the first 3."

Q: "What if I'm in a vertical you don't have a template for?"
NEW: "All 9 verticals are fully supported now: Roofing, HVAC, Plumbing, Legal, Real Estate, Insurance, 
      SaaS, Wholesale, Dental. Follow-up copy is customized for each industry."

Q: "Can I really get 30 days to decide?"
NEW: "Yes. First 30 days: if you're not seeing measurable results (calls answered, leads captured), 
      we refund your $1,500 setup fee. No questions asked. But most clients see ROI within week 1."
```

---

## PART 4: Cold Email Page Updates (Static HTML)

### Where to Update
**Files:** `public/{vertical}-leads/index.html` (all 9 pages)

### Key Sections to Add/Enhance

**ADD NEW SECTION: "Your Setup Is Instant" (after "Meet the [Name] Roster")**
```html
<section style="margin: 60px auto; max-width: 720px; text-align: center;">
  <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 12px; color: #FFFFFF;">
    Your AI Is Live in 24 Hours
  </h2>
  <p style="font-size: 15px; line-height: 1.8; color: #CBD5E1; margin-bottom: 32px;">
    No long setup. No lengthy onboarding. Here's what happens:
  </p>
  
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px;">
    <div style="background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.2); 
                border-radius: 10px; padding: 20px;">
      <div style="font-size: 36px; font-weight: 700; color: #D4AF37; margin-bottom: 8px;">1</div>
      <div style="font-size: 12px; font-weight: 600; color: #D4AF37; text-transform: uppercase; 
                  letter-spacing: 0.1em; margin-bottom: 8px;">24 Hours</div>
      <p style="font-size: 13px; color: #94A3B8; line-height: 1.6;">
        Unique phone number allocated and live. Your AI is answering calls.
      </p>
    </div>
    
    <div style="background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.2); 
                border-radius: 10px; padding: 20px;">
      <div style="font-size: 36px; font-weight: 700; color: #D4AF37; margin-bottom: 8px;">2</div>
      <div style="font-size: 12px; font-weight: 600; color: #D4AF37; text-transform: uppercase; 
                  letter-spacing: 0.1em; margin-bottom: 8px;">Questionnaire</div>
      <p style="font-size: 13px; color: #94A3B8; line-height: 1.6;">
        Fill a 5-min form about your business. Your AI learns your context, objections, language.
      </p>
    </div>
    
    <div style="background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.2); 
                border-radius: 10px; padding: 20px;">
      <div style="font-size: 36px; font-weight: 700; color: #D4AF37; margin-bottom: 8px;">∞</div>
      <div style="font-size: 12px; font-weight: 600; color: #D4AF37; text-transform: uppercase; 
                  letter-spacing: 0.1em; margin-bottom: 8px;">ROI Proof</div>
      <p style="font-size: 13px; color: #94A3B8; line-height: 1.6;">
        Every month: email showing calls answered, revenue protected, exact ROI multiplier.
      </p>
    </div>
  </div>
</section>
```

**ENHANCE EXISTING BENEFIT SECTIONS**
Add to each benefit description:
- Mention vertical-specific follow-up (if Pro tier)
- Mention automatic ROI tracking (all tiers)
- Mention business context from questionnaire (all tiers)

---

## PART 5: Sales Messaging Angles

### For Cold Email / Ads / Outreach

**Angle 1: Speed**
```
"Your AI is live in 24 hours. Unique phone number, configured for your industry, 
ready to answer calls. Not weeks. Not days. Tomorrow."
```

**Angle 2: ROI Proof**
```
"Monthly ROI email shows exactly what your AI saved you. Not guesses. 
Real numbers: calls answered, leads captured, revenue protected.  
$400/mo investment. $12,000+ protected every month? ROI: 30x."
```

**Angle 3: Vertical Expertise**
```
"Pro tier follow-up isn't generic. Legal gets deadline urgency. Real Estate gets 
market timing angles. Insurance gets coverage gap messaging. Your AI sounds like 
it understands your industry because it does."
```

**Angle 4: Business Context**
```
"After setup, you fill a questionnaire about your business, objections, language. 
Your AI learns all of it automatically. On calls, it references your specific services, 
handles your common objections, sounds like your team."
```

**Angle 5: Zero Risk**
```
"First 30 days: if you're not seeing results, we refund the $1,500 setup fee. 
Most clients see measurable impact (more calls answered, fewer missed leads) 
within the first week."
```

---

## PART 6: Tier Copy in Code

### Update `lib/tier-config.ts`

**Starter description:**
```typescript
description: 'Your AI receptionist is live in 24 hours. Unique phone number, 
             lead capture, daily summaries, and monthly ROI proof.'
```

**Pro description:**
```typescript
description: 'Receptionist + vertical-specific follow-up for ALL 9 industries. 
             Auto-configured, profit-tracking included.'
```

**Elite description:**
```typescript
description: 'Full AI team replacement. Receptionist, follow-up, call recording, 
             analytics. Your second brain, running 24/7.'
```

---

## PART 7: Implementation Checklist

### Files to Update

- [ ] **lib/tier-config.ts** — Update tier descriptions + features array
- [ ] **components/verticals/VerticalPricing.tsx** — Update COPY object (lines 12–58) + FAQ (lines 60–81)
- [ ] **public/roofing-leads/index.html** — Add "Live in 24 Hours" section + enhance benefits
- [ ] **public/hvac-leads/index.html** — Add "Live in 24 Hours" section + enhance benefits
- [ ] **public/plumbing-leads/index.html** — Add "Live in 24 Hours" section + enhance benefits
- [ ] **public/legal-automation/index.html** — Add "Live in 24 Hours" section + enhance benefits
- [ ] **public/real-estate-leads/index.html** — Add "Live in 24 Hours" section + enhance benefits
- [ ] **public/insurance-leads/index.html** — Add "Live in 24 Hours" section + enhance benefits
- [ ] **public/saas-optimization/index.html** — Add "Live in 24 Hours" section + enhance benefits
- [ ] **public/wholesale-leads/index.html** — Add "Live in 24 Hours" section + enhance benefits
- [ ] **public/dental-leads/index.html** — Add "Live in 24 Hours" section + enhance benefits

### What NOT to Change
- Homepage (`public/index.html`) — Current messaging is solid
- Agent cards on cold email pages — Keep structure, just update copy
- ROI calculator pages — Keep as-is for now

---

## PART 8: Messaging Priorities (In Order of Impact)

**Most Important:**
1. **Tier descriptions** — Sets expectation on pricing pages
2. **FAQ updates** — Answers "how fast?" and "how does this work?"
3. **Urgency angles** — Drives conversion on pricing page

**Secondary:**
4. **"Live in 24 Hours" section** — Shows concrete timeline
5. **Cold email page enhancements** — Supports sales messaging

---

## Summary

**What's New to Highlight:**
✓ 24-hour setup (unique phone number allocated same day)  
✓ Monthly ROI email (proof the service works)  
✓ Business context from questionnaire (AI knows your industry)  
✓ Follow-up for ALL 9 verticals (Pro tier parity achieved)  

**Tone:** Fast, proof-driven, vertical-specific  
**Urgency:** Focus on speed (24 hours) + ROI (exact numbers)  
**Call to Action:** Book a call or start checkout

---

**Ready for review. Make any changes you'd like, and I'll implement them all in the next session.**

# Dentrix API Integration Guide for 369
**Understanding Dentrix, Getting Credentials, Building the Integration**

---

## WHAT IS DENTRIX?

Dentrix is a **dental practice management system (PMS)**. It's essentially the "operating system" for dental offices.

When a patient calls, books an appointment, gets treated, or asks a question via email — that data lives in Dentrix.

**For your agents, Dentrix gives you:**
- Patient history (treatments, allergies, insurance, last visit)
- Appointment schedule (when they're coming in next)
- Treatment plans (what's planned vs. what's completed)
- Insurance info (what's covered, what's not)

**Your agents need this context** so they can say:
> "Hi Sarah, I see you're scheduled for your root canal follow-up next Thursday at 2pm. That should clear up the sensitivity you mentioned."

Instead of:
> "Hi Sarah, thanks for your email."

---

## THE REALITY CHECK

**Good news:** Dentrix has a public API (you found it)

**The challenge:** Dentrix API requires **authentication credentials** (API key + access token) from the dental practice. You can't just call it generically.

**Here's the flow:**
1. Dental practice signs up with 369
2. They give you their Dentrix API credentials (or authorize via OAuth)
3. Your system calls their Dentrix instance to pull patient data
4. Your agents use that data in the Claude prompt
5. Agents draft responses with context

---

## HOW TO GET STARTED (3 Options)

### Option A: Use a Demo/Test Account (Fastest — Do This First)

Dentrix likely has a **sandbox/demo environment** where you can test without a real practice.

**Steps:**
1. Go to https://papidocs.hs1api.com/publicapi/home
2. Look for "Sandbox" or "Testing Environment" in the API docs
3. Sign up for a demo account
4. Get test API credentials
5. Start building against the test environment

**Why:** You can build and test the entire integration without waiting for a real customer

### Option B: Contact Dentrix for Developer Access

**Steps:**
1. Go to Dentrix Developer Program (Image 1 shows "Sign Up" button)
2. Sign up as a developer
3. Request sandbox credentials
4. They'll send you API docs + test credentials

**Why:** Official path, but takes 1-3 days for approval

### Option C: Work with Your First Dental Customer

**Steps:**
1. Close your first dental customer
2. Ask them: "Can you give me your Dentrix API credentials so I can pull patient history into our system?"
3. They generate an API key in their Dentrix settings
4. You use their live credentials to build the integration

**Why:** Real data, but means integration happens AFTER first customer signed

---

## WHAT THE DENTRIX API ACTUALLY GIVES YOU

Looking at the documentation (Image 2), the Dentrix Public API has endpoints for:

**Key endpoints you'll need:**

```
GET /v1/patients/{patientId}
  → Returns: Name, DOB, Insurance, Allergies, Contact Info

GET /v1/patients/{patientId}/appointments
  → Returns: Scheduled appointments, dates, times

GET /v1/patients/{patientId}/treatmentplan
  → Returns: Planned treatments, completed treatments, costs

GET /v1/patients/{patientId}/communications
  → Returns: Past emails/messages with the patient (optional, if available)
```

**These endpoints are what your agents need.** When an email comes in from a patient, you:
1. Parse the patient's email address
2. Look them up in Dentrix (GET /v1/patients?email=*)
3. Fetch their history (appointments, treatment plan, insurance)
4. Pass that context to Claude
5. Claude drafts a response knowing their history

---

## THE INTEGRATION CODE PATTERN

Here's what `lib/integrations/dentrix.ts` would look like:

```typescript
import axios from 'axios';

export async function getDentrixPatient(email: string, dentrixApiKey: string) {
  try {
    // Step 1: Look up patient by email
    const patientResponse = await axios.get(
      'https://hs1api.com/v1/patients',
      {
        params: { email },
        headers: { 'Authorization': `Bearer ${dentrixApiKey}` }
      }
    );

    const patient = patientResponse.data[0]; // Get first match
    if (!patient) return null;

    // Step 2: Get their appointment schedule
    const appointmentsResponse = await axios.get(
      `https://hs1api.com/v1/patients/${patient.id}/appointments`,
      {
        headers: { 'Authorization': `Bearer ${dentrixApiKey}` }
      }
    );

    // Step 3: Get their treatment plan
    const treatmentResponse = await axios.get(
      `https://hs1api.com/v1/patients/${patient.id}/treatmentplan`,
      {
        headers: { 'Authorization': `Bearer ${dentrixApiKey}` }
      }
    );

    // Return context object for Claude
    return {
      patientName: patient.name,
      lastVisit: patient.lastVisitDate,
      insurance: patient.insurance,
      allergies: patient.allergies,
      nextAppointment: appointmentsResponse.data[0], // Soonest appointment
      treatmentPlan: treatmentResponse.data,
      upcomingTreatments: treatmentResponse.data.filter(t => !t.isCompleted)
    };
  } catch (error) {
    console.error('Dentrix API error:', error);
    return null;
  }
}
```

Then in your Claude prompt:

```typescript
const dentalContext = await getDentrixPatient(patientEmail, dentrixApiKey);

const systemPrompt = `
You are a helpful dental practice assistant. You have access to the patient's history:

Patient: ${dentalContext.patientName}
Last Visit: ${dentalContext.lastVisit}
Insurance: ${dentalContext.insurance}
Allergies: ${dentalContext.allergies}
Next Appointment: ${dentalContext.nextAppointment?.dateTime}
Upcoming Treatments: ${dentalContext.upcomingTreatments.map(t => t.name).join(', ')}

Based on their history, draft a helpful, personalized response to their email.
`;
```

---

## WHAT YOU NEED TO DO RIGHT NOW

**Priority 1: Get Test Credentials (Today)**

Go to Dentrix Developer Program:
1. Visit https://papidocs.hs1api.com (the developer portal)
2. Look for "Sign Up" or "Sandbox Environment"
3. Create a developer account
4. Request sandbox/test API credentials
5. Save the credentials (API Key, Base URL, etc.)

**In email or Slack to me:** "I've signed up for Dentrix sandbox. Waiting for credentials."

**Priority 2: Review the API Docs (While Waiting)**

Spend 30 mins reading:
1. API Endpoints section (what data you can fetch)
2. Authentication section (how to use API keys)
3. Patient endpoints specifically (GET /patients, GET /patients/{id}, etc.)

You don't need to understand everything, just get familiar with the shape of the data.

**Priority 3: Start Building Once You Have Credentials (Thursday)**

Once credentials arrive:
- [ ] Build `lib/integrations/dentrix.ts` (the code above, adapted)
- [ ] Test: Call Dentrix API with test credentials
- [ ] Verify: Can you fetch a test patient's history?
- [ ] Integrate: Pass that history to Claude in the system prompt
- [ ] Test end-to-end: Email in → Dentrix lookup → Claude draft with patient context → response

---

## THE SIMPLE EXPLANATION (For When You're Confused)

**TL;DR:**
- Dentrix = where dental practices store patient data
- Dentrix API = way for you to read that patient data
- Your agents need that data to be smart
- You need API credentials (keys) to call the Dentrix API
- Sign up for sandbox → get test credentials → build integration → test → ship

**That's it.** You're not doing anything magical. You're just making HTTP requests to get patient data, then passing it to Claude.

---

## IF YOU GET STUCK

**Common questions:**

**Q: Do I need a real Dentrix account to test?**
A: No. Dentrix should have a sandbox/test environment. Start there.

**Q: How do I get the patient's API key?**
A: They generate it in their Dentrix settings (usually Admin → API Keys). You ask them to share it when they sign up.

**Q: Will this work with other dental software (Eaglesoft, Open Dental)?**
A: Yes, each has its own API. But start with Dentrix since it's the largest.

**Q: How long does it take to build?**
A: With credentials + API docs: 4-6 hours of focused work.

---

## NEXT STEPS (In Order)

1. **Today:** Sign up for Dentrix Developer Program, request sandbox credentials
2. **Tomorrow:** Review API docs while waiting
3. **Thursday:** Credentials arrive → Build `lib/integrations/dentrix.ts`
4. **Friday:** Test end-to-end, verify it works
5. **Next week:** Integrate into your email → Claude → response flow

---

**Questions? Ask me. This is exactly what I'm here for.**

**For now: Go sign up and get those sandbox credentials. That's the only blocker.**

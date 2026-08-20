# Rental voice test — what to say on the phone

**Call +1 (817) 612-6757.** Not the demo line.

Ava now answers as an **event & party rental** receptionist with 40 items in stock. Weekend hours
are open (Sat 08:00–20:00, Sun 10:00–18:00) and the booking horizon is 180 days.

Say the line in **bold**. The line under it is what should happen. That's the whole test.

---

## Call 1

**1. "Hi — do you rent bounce houses?"**
She should say yes and ask which one, or ask what you need. She should sound like a rental
company, not a roofer.

**2. "Do you have the Princess Castle this Saturday?"**
She should check, then offer a **window** — something like *"Saturday the 22nd through Sunday the
23rd, one day."* The important part: **she says both days and a day count**, not just a start time.

**3. "Can I have the 20x40 frame tent for just one day?"**
She should **say no** and tell you it goes out for **at least 2 days**, then ask if that works.
If she offers you one day anyway, that's a bug — write it down.

**4. "Okay, what about a photo booth Saturday afternoon?"**
She should ask **enclosed or open air**, then offer **normal times** — "2:00 PM", "3:00 PM".
**Not** a multi-day window. Photo booths are same-day items and must still behave the old way.

**5. "Let's book the Portable Dance Floor for three days starting Saturday."**
Give her a name, phone, email and address when she asks. Let her complete the booking.
Note down what she says the return day is.

**6. Let her ask about texting you.** Say yes or no — either is fine, just confirm she asks once
and doesn't nag.

---

## Call 2 — the one that proves the fix

Wait a minute, then call back.

**"Is the Portable Dance Floor free on Sunday?"** (the day *after* the one you booked)

**It must be unavailable.** There is only one, and you just took it for three days.

If she offers it, that is **the exact bug this whole build was for** — a unit reading as free
while it is physically at a customer's party. That is the single most important answer of the
whole test.

---

## Two things that are NOT bugs

- **Ask for "a castle" and she may not ask which one.** `check_availability` is deliberately
  permissive; the "which one did you mean?" refusal happens at **booking**, not when checking. So
  the clarifying question may come later than you expect.
- **Ask for the mechanical bull and she may not say "we don't have that"** when merely checking —
  it is marked unavailable, and the same permissive rule applies. It should be refused when you
  try to book it.

---

## After the calls

Check what actually got stored — especially that the 3-day booking has an `ends_at` three days
after its start, not one hour:

```
node --env-file=.env.local -e "const{createClient}=require('@supabase/supabase-js');const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);s.from('bookings').select('inventory_item_key,starts_at,ends_at').order('created_at',{ascending:false}).limit(5).then(r=>console.table(r.data))"
```

## Putting Northside back afterwards

```
node --env-file=.env.local -e "const{createClient}=require('@supabase/supabase-js');const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);s.from('client_inventory').delete().eq('client_domain','www.Northsideroofing.com').then(()=>console.log('inventory cleared'))"
```

The rental prompt, the rental tool parameters and the weekend schedule stay until removed by hand.
The original LLM config is backed up in the session scratchpad as
`northside-llm-backup-2026-08-20.json`.

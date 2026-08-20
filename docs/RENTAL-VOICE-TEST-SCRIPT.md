# Rental voice test — call script

**Number: +1 (817) 612-6757 (Northside).** Not the demo line — the demo line has no subscription
row, so it can never see inventory and proves nothing here.

**Read this first.** Northside is a *roofing* agent carrying a party-rental stock list. That
mismatch is deliberate and temporary: it is the only agent safe to experiment on, and its prompt
was already due a rebuild. Expect Ava to sound slightly odd about *what the business is* — that is
not the thing under test. What **is** under test is whether the tools return the right items,
windows and refusals.

Backup of the original LLM config (prompt, greeting, all tools) is in the session scratchpad as
`northside-llm-backup-2026-08-20.json`.

---

## What to listen for, not just what to say

Each case below has a **pass** condition. A wrong-but-fluent answer is the failure mode that
matters — Ava sounding confident while booking the wrong thing.

### 1. The ambiguity refusal (the one that protects a birthday party)

> "Hi, do you have a castle available Saturday?"

**Pass:** she asks *which* castle, naming the three — Princess Castle, Castle Combo, Medieval
Castle. **Fail:** she picks one. That is the wrong van to a child's party.

### 2. The too-many-to-read branch

> "I need a table."

**Pass:** she does **not** recite a list. She should ask you to narrow it — a model number, or
what kind. "Table" matches **11** items because the matcher is substring-based and
"infla-**table**" and "por-**table**" both contain it.
**Fail:** she reads out eleven items. Nobody can listen to that.

### 3. Multi-day hire — the whole point of the build

> "How much for the 20x40 frame tent for the weekend?"
> "Can I get it Friday through Sunday?"

**Pass:** she offers a **window**, saying both the collection day and the day it is due back,
with a day count. The 20x40 is configured minimum **2** days, maximum **14**.
**Fail:** she offers a one-hour slot, or states only a start day. Stating the start alone hides
the number the price depends on.

### 4. The range refusal

> "Can I get the 20x40 tent for just one day?"

**Pass:** she declines and says it goes out for **at least 2 days**, then asks how long you need.
**Fail:** she books one day. That silently re-prices the hire.

### 5. The hold actually holds

Book the **Portable Dance Floor** (there is only 1) for 3 days. Then call back:

> "Is the dance floor free two days from now?"

**Pass:** no. It is out. **Fail:** it is offered — that is the original bug, a unit reading as
free while it is physically at a customer's site.

### 6. Same-day items still behave as before

> "Do you have a photo booth for Saturday afternoon?"

**Pass:** she asks enclosed or open air, then offers **normal time slots** — not a multi-day
window. Photo booths have no `min_rental_days`, so they must still book as intra-day
appointments. This is the load-bearing case: if same-day stock started getting hire windows,
every existing client would break.

### 7. The inactive item

> "Do you have the mechanical bull?"

**Pass:** she says they do not stock it — it is marked unavailable and `loadInventory` only
returns active rows. **Fail:** she offers it.

---

## After the calls

```
node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-booking.mjs 2
node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-inventory.mjs
```

Then check the bookings directly — the thing worth confirming is that a multi-day hire stored an
`ends_at` spanning the hire, not one slot:

```
node --env-file=.env.local -e "const{createClient}=require('@supabase/supabase-js');const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);s.from('bookings').select('inventory_item_key,starts_at,ends_at').order('created_at',{ascending:false}).limit(5).then(r=>console.table(r.data))"
```

## Putting Northside back

```
node --env-file=.env.local -e "const{createClient}=require('@supabase/supabase-js');const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);s.from('client_inventory').delete().eq('client_domain','www.Northsideroofing.com').then(()=>console.log('inventory cleared'))"
```

The prompt line added by `set-rental-tools.mjs` stays until removed by hand or overwritten by a
questionnaire re-submit. Restore the full original from the backup JSON if it matters.

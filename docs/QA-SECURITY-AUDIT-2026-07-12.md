# QA Security & Routing Audit — 369 Agentic Systems
**Date:** 2026-07-12  
**Auditor:** Lead Next.js QA Engineer  
**Status:** 🚨 **CRITICAL ISSUES FOUND** — Immediate action required

---

## Executive Summary

Found **9 security and architectural issues** across authentication, webhook handling, data fetching, and API design. **3 are CRITICAL** and require immediate remediation before production traffic increases.

| Severity | Count | Impact |
|----------|-------|--------|
| 🔴 **CRITICAL** | 3 | Authentication bypass, data corruption, unauthorized access |
| 🟠 **HIGH** | 2 | Timing attacks, sensitive data exposure |
| 🟡 **MEDIUM** | 4 | Error leakage, SQL injection risk, inconsistent error handling |

---

## Issue Catalog

### 1. 🔴 CRITICAL: Retell Webhook Has No Signature Verification

**File:** `app/api/call-received/route.ts`  
**Lines:** 14–40  
**Severity:** CRITICAL  
**Impact:** Unauthenticated actors can fabricate call data, corrupting analytics and revenue tracking

**The Flaw:**
```typescript
export async function POST(request: NextRequest) {
  let webhook: Record<string, unknown>
  try {
    webhook = await request.json()
  } catch {
    console.error('[RETELL] ✗  Failed to parse JSON')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  
  // ❌ NO VERIFICATION — accepts any JSON as valid Retell event
  const event = webhook.event as string | undefined
```

**Why This Is Critical:**
- Anyone with network access to `/api/call-received` can POST fake call data
- Attacker can create fake "booked" appointments → corrupts ROI calculations
- Attacker can attribute calls to victim accounts → pollutes analytics
- No rate limiting, no signature check, no IP allowlist

**Fix:**
```typescript
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  // ✅ Extract signature from headers (Retell sends this)
  const signature = request.headers.get('X-Retell-Signature')
  const rawBody = await request.text()

  if (!process.env.RETELL_WEBHOOK_SECRET) {
    console.error('[RETELL] RETELL_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // ✅ Verify signature using HMAC
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RETELL_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  if (!signature || signature !== expectedSignature) {
    console.error('[RETELL] ✗  Signature mismatch', { provided: signature, expected: expectedSignature })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ✅ Now safe to parse
  let webhook: Record<string, unknown>
  try {
    webhook = JSON.parse(rawBody)
  } catch {
    console.error('[RETELL] ✗  Failed to parse JSON')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = webhook.event as string | undefined
  // ... rest of endpoint
}
```

**Required Action:**
1. Add `RETELL_WEBHOOK_SECRET` to environment variables
2. Get webhook secret from Retell dashboard (Settings → Webhooks → Secret key)
3. Deploy and test with real Retell webhook

---

### 2. 🔴 CRITICAL: Hardcoded Demo Domain — All Calls Misattributed

**File:** `app/api/call-received/route.ts`  
**Lines:** 53, 87  
**Severity:** CRITICAL  
**Impact:** All calls inserted into database belong to `demo.369agenticsystems.com`, not actual customer

**The Flaw:**
```typescript
  if (event === 'call_started') {
    const { error } = await supabase.from('calls').insert({
      call_id:      callId,
      client_domain: 'demo.369agenticsystems.com',  // ❌ HARDCODED — ignores who actually owns this agent
      caller_phone: fromNumber ?? 'unknown',
      call_outcome: 'in_progress',
      created_at:   receivedAt,
    })
```

**Why This Is Critical:**
- Every customer's calls get attributed to the demo account
- Demo account now has all real customer data (names, phone numbers, transcripts)
- Customer dashboards show `0 calls` (their calls are in someone else's account)
- Revenue calculations completely wrong
- **This explains why you asked "how are these things getting missed" — the data is literally going to the wrong place**

**Fix:**

Option A: Extract from Retell webhook (if Retell sends client identifier):
```typescript
// In Retell webhook payload, look for custom metadata
const clientDomain = (webhook.metadata?.client_domain as string | undefined) 
  ?? (webhook.custom_context?.client_domain as string | undefined)

if (!clientDomain) {
  console.error('[RETELL] ✗  Missing client_domain in webhook metadata')
  return NextResponse.json({ error: 'Missing client identification' }, { status: 400 })
}

const { error } = await supabase.from('calls').insert({
  call_id:      callId,
  client_domain: clientDomain,  // ✅ From webhook metadata
  caller_phone: fromNumber ?? 'unknown',
  call_outcome: 'in_progress',
  created_at:   receivedAt,
})
```

Option B: Map agent_id to customer domain (if Retell sends agent_id):
```typescript
const agentId = webhook.agent_id as string | undefined
if (!agentId) {
  console.error('[RETELL] ✗  Missing agent_id')
  return NextResponse.json({ error: 'Missing agent identification' }, { status: 400 })
}

// Look up which customer owns this agent
const { data: config, error: configError } = await supabase
  .from('agent_configurations')
  .select('client_domain')
  .eq('retell_agent_id', agentId)
  .single()

if (configError || !config?.client_domain) {
  console.error('[RETELL] ✗  Agent not found or not configured:', agentId)
  return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
}

const { error } = await supabase.from('calls').insert({
  call_id:      callId,
  client_domain: config.client_domain,  // ✅ Looked up from agent registry
  caller_phone: fromNumber ?? 'unknown',
  call_outcome: 'in_progress',
  created_at:   receivedAt,
})
```

**Required Action:**
1. Determine which Retell webhook field contains customer identification
2. Implement lookup or extraction above
3. **Do NOT deploy additional customers until this is fixed**
4. Migrate existing demo calls to correct customer accounts or mark as test data

---

### 3. 🔴 CRITICAL: Module-Level Supabase Admin Client — Credentials Baked Into Process

**Files:**
- `app/api/call-received/route.ts` (lines 4–7)
- `app/api/search-transcripts/route.ts` (lines 9–12)
- `app/api/send-setup-instructions/route.ts` (similar pattern)

**Severity:** CRITICAL  
**Impact:** If SUPABASE_SERVICE_ROLE_KEY rotates, all these endpoints fail until redeployment. No graceful degradation.

**The Flaw:**
```typescript
// ❌ Instantiated at module load time — survives for entire server lifetime
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Uses the stale client if credentials rotated
}
```

**Why This Is Critical:**
- If service role key needs to be rotated (security incident, employee departure), old processes keep using old key
- New deployments get new key, old processes get 403 Forbidden forever
- Requires killing all running instances (Vercel/Node processes) to pick up new key
- No retry logic, no fallback

**Fix:**
```typescript
// ✅ Create client per-request (fresh environment lookup each time)
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Use supabase...
}

// OR: Use a factory with refresh logic
let clientCache: ReturnType<typeof createClient> | null = null
let lastKeyRotation = Date.now()

function getSupabaseAdmin() {
  const now = Date.now()
  const keyAge = now - lastKeyRotation
  
  // Refresh client every 15 minutes to pick up rotated keys
  if (!clientCache || keyAge > 15 * 60 * 1000) {
    clientCache = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    lastKeyRotation = now
  }
  
  return clientCache
}
```

**Required Action:**
1. Move Supabase client creation inside each route handler
2. Apply to all files using module-level `createClient()` with SERVICE_ROLE_KEY
3. Test credential rotation: manually change env var and confirm no downtime

---

### 4. 🟠 HIGH: Cron Endpoints Protected Only By Query String Secret

**Files:**
- `app/api/cron/silence-check/route.ts`
- `app/api/cron/weekly-digest/route.ts`
- `app/api/cron/rex-sequence-advance/route.ts`
- `app/api/cron/send-monthly-roi-reports/route.ts`
- `app/api/cron/sync-questionnaire-kb/route.ts`

**Severity:** HIGH  
**Impact:** Cron secret passed in query string is visible in server logs, Vercel dashboards, and HTTP referrers

**The Flaw:**
```typescript
// example from silence-check
const authToken = request.nextUrl.searchParams.get('cron_secret')
if (authToken !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Why This Is High Risk:**
- Query string secrets are logged everywhere (CDN logs, browser history, server logs)
- Not rate-limited — brute-force is technically possible on a 10-char string
- Vercel Cron UI shows full URL including secret
- Referrer header leaks secret if user clicks off during execution

**Fix:**
```typescript
// ✅ Use Authorization header instead
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (!authHeader || authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Vercel Cron signature if available
  const veracelCronSecret = request.headers.get('x-vercel-cron-secret')
  if (veracelCronSecret !== process.env.VERCEL_CRON_SECRET) {
    return NextResponse.json({ error: 'Invalid cron signature' }, { status: 401 })
  }
}
```

**Also Update vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/silence-check",
      "schedule": "0 15 * * 1-5"
      // ✅ Do NOT include secret in URL — Vercel injects via header
    }
  ]
}
```

**Required Action:**
1. Migrate all cron endpoints to use Authorization header
2. Update Vercel cron configuration to not include secret in URL
3. Store `VERCEL_CRON_SECRET` in Vercel environment variables

---

### 5. 🟠 HIGH: Dashboard Page Calls Supabase Admin With User Context Unknown

**File:** `app/(portal)/dashboard/page.tsx`  
**Lines:** 13–16  
**Severity:** HIGH  
**Impact:** If async auth check in middleware is slow, unauthenticated user could briefly access admin data

**The Flaw:**
```typescript
export default async function DashboardPage() {
  noStore()

  const supabase      = createClient()  // ✅ Uses anon key
  const supabaseAdmin = createAdminClient(  // ❌ Uses service role key
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { data: { user } },  // ← Auth check happens AFTER creating admin client
    // ...queries using admin client...
  ] = await Promise.all([...])
```

**Why This Is High:**
- Admin client created before confirming user identity
- If user auth check fails/times out, admin client is already "hot" in memory
- Middleware runs separately, no guarantee it checked before Page component starts
- Race condition window exists

**Fix:**
```typescript
export default async function DashboardPage() {
  noStore()

  const supabase = createClient()
  
  // ✅ Check auth FIRST
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user || authError) {
    redirect('/login')
  }

  // ✅ Only create admin client AFTER confirming authenticated user
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { count: totalAudits },
    // ... rest of admin queries ...
  ] = await Promise.all([...])
}
```

**Required Action:**
1. Add auth check before any admin data fetching
2. Verify middleware is also protecting the route (it is — line 53 of middleware.ts)
3. Add integration test: manually tamper with session cookie, verify 403 (not data leak)

---

### 6. 🟡 MEDIUM: API Errors Expose Database Details

**Files:** Multiple API endpoints  
**Example:** `app/api/search-transcripts/route.ts` (lines 112–117)  

**Severity:** MEDIUM  
**Impact:** Attackers learn database schema, Supabase instance details

**The Flaw:**
```typescript
const { data: calls, error } = await q

if (error) {
  console.error('[SEARCH] Query error:', error)
  return NextResponse.json(
    { error: 'Search failed' },  // ← Good, doesn't expose error
    { status: 500 }
  )
}
```

**Actually, this one is fine.** But check these:

**`app/api/call-received/route.ts` (lines 59–62):**
```typescript
if (error) {
  console.error('[RETELL] ✗  Insert failed:', error.message)  // ← Logs internal error
  return NextResponse.json({ error: error.message }, { status: 500 })  // ❌ Returns Supabase error to client
}
```

**Fix:**
```typescript
if (error) {
  console.error('[RETELL] ✗  Insert failed:', error.message)
  // ✅ Generic message to client
  return NextResponse.json(
    { error: 'Failed to log call' },  // Don't expose Supabase internals
    { status: 500 }
  )
}
```

**Required Action:**
1. Audit all API endpoints for error.message leakage
2. Standardize: log detailed error server-side, return generic message to client
3. Add error tracking (Sentry) if not already done

---

### 7. 🟡 MEDIUM: SQL Injection Risk Via `.ilike()` Search

**File:** `app/api/search-transcripts/route.ts`  
**Lines:** 91  
**Severity:** MEDIUM  
**Impact:** Malicious search query could potentially probe or extract data

**The Flaw:**
```typescript
.ilike('transcript', `%${query}%`)
```

**Why This Is Medium (Not Critical):**
- Supabase uses parameterized queries under the hood (SQL injection is mitigated)
- But the `ilike` operator with user input deserves explicit validation

**Fix:**
```typescript
// ✅ Validate query before passing to database
const query = (searchParams.get('query') || '').trim()

if (!query || query.length < 2) {
  return NextResponse.json(
    { error: 'Search query must be at least 2 characters' },
    { status: 400 }
  )
}

if (query.length > 500) {
  return NextResponse.json(
    { error: 'Search query too long (max 500 chars)' },
    { status: 400 }
  )
}

// ✅ Escape special regex characters if using regex
const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

.ilike('transcript', `%${escapedQuery}%`)
```

**Required Action:**
1. Add input validation to all search/filter endpoints
2. Validate query length, character set
3. Consider using full-text search operators instead of ilike for better performance

---

### 8. 🟡 MEDIUM: Middleware Async Auth Check No Timeout

**File:** `middleware.ts`  
**Lines:** 34  
**Severity:** MEDIUM  
**Impact:** If Supabase is slow/down, request hangs indefinitely

**The Flaw:**
```typescript
// No timeout — if Supabase is down, request waits forever
const { data: { user } } = await supabase.auth.getUser()
```

**Fix:**
```typescript
// ✅ Add timeout
const authPromise = supabase.auth.getUser()
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Auth check timeout')), 5000)
)

let user: AuthUser | null = null
try {
  const { data: { user: authUser } } = await Promise.race([authPromise, timeoutPromise]) as any
  user = authUser
} catch (err) {
  console.error('[Middleware] Auth check failed:', err)
  return NextResponse.redirect(new URL('/login', request.url))
}
```

**Required Action:**
1. Add 5-second timeout to auth checks
2. If Supabase times out, redirect to login (safe default)
3. Monitor middleware logs for timeout frequency

---

### 9. 🟡 MEDIUM: No Rate Limiting On Public API Endpoints

**Files:**
- `app/api/early-access/route.ts`
- `app/api/questionnaire/submit/route.ts`
- `app/api/capture-lead/route.ts`

**Severity:** MEDIUM  
**Impact:** DOS attack possible — attacker can spam form submissions, exhausting Supabase quota

**The Flaw:**
```typescript
// No rate limiting — anyone can POST unlimited times
export async function POST(request: NextRequest) {
  const data = await request.json()
  const { error } = await supabase.from('leads').insert(data)
}
```

**Fix:**
```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 h'),  // 5 requests per hour per IP
})

export async function POST(request: NextRequest) {
  const ip = request.ip ?? 'unknown'
  const { success } = await ratelimit.limit(ip)
  
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  // ... rest of handler
}
```

**Required Action:**
1. Add Upstash Redis rate limiting to public endpoints
2. Configure limits: 5 requests per hour for signups, 20 per hour for searches
3. Monitor 429 responses in production logs

---

## Summary Table

| Issue | File | Severity | Fix Time | Risk |
|-------|------|----------|----------|------|
| No Retell webhook signature | `app/api/call-received/route.ts` | 🔴 CRITICAL | 30 min | Data corruption, fraud |
| Hardcoded demo domain | `app/api/call-received/route.ts` | 🔴 CRITICAL | 1 hour | All calls misattributed |
| Module-level admin client | Multiple API files | 🔴 CRITICAL | 2 hours | Credential rotation fails |
| Cron secret in query string | `app/api/cron/*` | 🟠 HIGH | 1 hour | Log exposure, brute-force |
| Unprotected admin data fetch | `app/(portal)/dashboard/page.tsx` | 🟠 HIGH | 30 min | Race condition window |
| Error message leakage | Multiple API files | 🟡 MEDIUM | 1 hour | Schema disclosure |
| SQL injection via ilike | `app/api/search-transcripts/route.ts` | 🟡 MEDIUM | 30 min | Data probing risk |
| Middleware auth timeout | `middleware.ts` | 🟡 MEDIUM | 30 min | Hanging requests |
| No rate limiting | Public API endpoints | 🟡 MEDIUM | 2 hours | DOS possible |

---

## Deployment Blockers

**Do NOT deploy to production until these are fixed:**

1. ✋ **Retell webhook signature verification** — Blocks unauthenticated call injection
2. ✋ **Hardcoded demo domain fix** — Blocks data misattribution  
3. ✋ **Module-level Supabase client refactor** — Blocks credential rotation

**Can deploy after these (medium priority):**
- Cron endpoint security (header-based auth)
- Dashboard auth ordering
- Input validation + rate limiting

---

## Remediation Plan

**Phase 1 (Today — Blocking Issues):**
- [ ] Add Retell webhook signature verification
- [ ] Extract client_domain from webhook metadata (or agent_id lookup)
- [ ] Move Supabase admin client creation into route handlers

**Phase 2 (This Week):**
- [ ] Migrate cron endpoints to Authorization headers
- [ ] Fix dashboard auth check ordering
- [ ] Audit and standardize error messages

**Phase 3 (Next Week):**
- [ ] Add rate limiting to public endpoints
- [ ] Add input validation to all search/filter endpoints
- [ ] Add timeout to middleware auth check

---

**Generated:** 2026-07-12 | **Next Review:** After Phase 1 fixes deployed


/**
 * Search call transcripts (Elite tier feature)
 * GET /api/search-transcripts?query=...&outcome=...&dateRange=...
 *
 * client_domain is derived from the authenticated session — NEVER from a query
 * param. Accepting it as input let any logged-in user read any other Elite
 * client's transcripts by passing their domain (IDOR / BOLA). Ownership is
 * resolved the same way as /api/export-calls: look up the caller's own
 * subscription by their session email, then scope the search to that domain.
 */

import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Reads request.nextUrl.searchParams on every call — must never be statically
// optimized, or Next.js throws "Dynamic server usage" instead of running the search.
export const dynamic = 'force-dynamic'

function getDateRangeFilter(dateRange: string): string {
  const now = new Date()
  let startDate = new Date()

  switch (dateRange) {
    case '7d':
      startDate.setDate(now.getDate() - 7)
      break
    case '30d':
      startDate.setDate(now.getDate() - 30)
      break
    case '90d':
      startDate.setDate(now.getDate() - 90)
      break
    default:
      // 'all' — no date filter
      return ''
  }

  return startDate.toISOString()
}

function extractSnippet(transcript: string, query: string, contextLength = 150): string {
  if (!transcript || !query) return transcript.slice(0, 200)

  const lowerTranscript = transcript.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerTranscript.indexOf(lowerQuery)

  if (index === -1) {
    return transcript.slice(0, 200) + '...'
  }

  const start = Math.max(0, index - contextLength)
  const end = Math.min(transcript.length, index + query.length + contextLength)

  const snippet = transcript.slice(start, end)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < transcript.length ? '...' : ''

  return prefix + snippet + suffix
}

export async function GET(request: NextRequest) {
  try {
    // ── Authenticate + resolve the caller's OWN domain from the session ───────
    const sessionClient = createClient()
    const { data: { user } } = await sessionClient.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: subscription } = await supabase
      .from('agent_subscriptions')
      .select('client_domain, tier')
      .eq('user_email', user.email)
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    // Elite-only — tier comes from the caller's OWN subscription, not a
    // looked-up domain that could belong to anyone else.
    if (subscription.tier !== 'Elite') {
      return NextResponse.json(
        { error: 'Transcript search available for Elite tier only' },
        { status: 403 }
      )
    }

    const clientDomain = subscription.client_domain

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query')
    const outcome = searchParams.get('outcome') || 'all'
    const dateRange = searchParams.get('dateRange') || 'all'

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    // Build query — always scoped to the authenticated caller's own domain.
    // The % and _ LIKE wildcards in an attacker-supplied term are harmless here
    // (bound parameter, single-tenant scope), but keep the term literal.
    let q = supabase
      .from('calls')
      .select('id, call_id, caller_name, caller_phone, duration_seconds, transcript, recording_url, call_outcome, created_at')
      .eq('client_domain', clientDomain)
      .ilike('transcript', `%${query}%`)

    // Filter by outcome
    if (outcome !== 'all') {
      q = q.eq('call_outcome', outcome)
    }

    // Filter by date range
    const startDate = getDateRangeFilter(dateRange)
    if (startDate) {
      q = q.gte('created_at', startDate)
    }

    // Sort by recency
    q = q.order('created_at', { ascending: false })

    // Limit to 50 results
    q = q.limit(50)

    const { data: calls, error } = await q

    if (error) {
      console.error('[SEARCH] Query error:', error)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    // Format results with snippets
    const results = (calls || []).map((call) => ({
      id: call.id,
      callId: call.call_id,
      callerName: call.caller_name,
      callerPhone: call.caller_phone,
      duration: call.duration_seconds,
      transcript: call.transcript || '',
      recordingUrl: call.recording_url,
      outcome: call.call_outcome,
      date: new Date(call.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      snippet: extractSnippet(call.transcript || '', query),
    }))

    console.log(`[SEARCH] Found ${results.length} results for ${JSON.stringify(query)} in ${clientDomain}`)

    return NextResponse.json({
      success: true,
      query,
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('[SEARCH] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Search call transcripts (Elite tier feature)
 * GET /api/search-transcripts?clientDomain=...&query=...&outcome=...&dateRange=...
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const searchParams = request.nextUrl.searchParams
    const clientDomain = searchParams.get('clientDomain')
    const query = searchParams.get('query')
    const outcome = searchParams.get('outcome') || 'all'
    const dateRange = searchParams.get('dateRange') || 'all'

    if (!clientDomain || !query) {
      return NextResponse.json(
        { error: 'Missing clientDomain or query' },
        { status: 400 }
      )
    }

    // Verify client tier is Elite
    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('tier')
      .eq('client_domain', clientDomain)
      .single()

    if (subError || !subscription || subscription.tier !== 'Elite') {
      return NextResponse.json(
        { error: 'Transcript search available for Elite tier only' },
        { status: 403 }
      )
    }

    // Build query
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

    console.log(`[SEARCH] Found ${results.length} results for "${query}" in ${clientDomain}`)

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

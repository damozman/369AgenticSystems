import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: subscription } = await supabaseAdmin
    .from('agent_subscriptions')
    .select('client_domain')
    .eq('user_email', user.email)
    .maybeSingle()

  if (!subscription) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  const { data: calls, error } = await supabaseAdmin
    .from('calls')
    .select('created_at,caller_name,caller_phone,duration_seconds,call_outcome,transcript')
    .eq('client_domain', subscription.client_domain)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const header = ['Date', 'Time', 'Caller Name', 'Caller Phone', 'Duration (s)', 'Outcome', 'Transcript']

  const rows = (calls ?? []).map(c => {
    const dt = new Date(c.created_at)
    return [
      dt.toLocaleDateString('en-US'),
      dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      c.caller_name ?? '',
      c.caller_phone ?? '',
      c.duration_seconds ?? '',
      c.call_outcome ?? '',
      // Wrap transcript in quotes, escape internal quotes
      c.transcript ? `"${c.transcript.replace(/"/g, '""')}"` : '',
    ].join(',')
  })

  const csv = [header.join(','), ...rows].join('\r\n')
  const filename = `calls-${subscription.client_domain}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

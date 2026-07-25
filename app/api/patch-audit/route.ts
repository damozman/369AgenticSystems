import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/admin'

export async function POST(req: NextRequest) {
  // Admin-only mutation. Previously unauthenticated: anyone on the internet could
  // POST an audit id and flip leak_detected / payload_status on any row. Only the
  // internal Command Center (DiagnosticDrawer) legitimately calls this.
  const sessionClient = createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json()

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabaseAdmin
    .from('system_audits')
    .update({ leak_detected: false, payload_status: 'active' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

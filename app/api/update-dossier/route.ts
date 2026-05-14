import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Uses the service-role key to bypass RLS — server-to-server only.
// This endpoint receives Gumloop webhook payloads.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { source_tag, client_name, client_email, client_company, output, ...rest } = payload

    if (!source_tag || !client_email) {
      return NextResponse.json({ error: 'Missing source_tag or client_email' }, { status: 400 })
    }

    // Upsert the client record
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .upsert(
        { email: client_email, company_name: client_company },
        { onConflict: 'email' }
      )
      .select()
      .single()

    if (clientErr) throw clientErr

    // Log the dossier entry
    const { error: logErr } = await supabaseAdmin
      .from('dossier_logs')
      .insert({
        client_id:  client.id,
        source_tag,
        payload:    { client_name, ...rest },
        output:     output ?? null,
        status:     output ? 'complete' : 'pending',
      })

    if (logErr) throw logErr

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/update-dossier]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

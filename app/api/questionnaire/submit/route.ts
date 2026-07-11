import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncQuestionnaireToKB } from '@/lib/retell-kb-sync'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client_domain, ...formData } = body

    if (!client_domain) {
      return NextResponse.json({ error: 'client_domain is required' }, { status: 400 })
    }

    // Verify the client domain exists and the user owns it
    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('id, user_email')
      .eq('client_domain', client_domain)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Client domain not found' }, { status: 404 })
    }

    // Upsert questionnaire
    const { error: questError } = await supabase
      .from('client_questionnaires')
      .upsert({
        client_domain,
        ...formData,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'client_domain' })

    if (questError) {
      console.error('[QUESTIONNAIRE] Save failed:', questError.message)
      return NextResponse.json({ error: questError.message }, { status: 500 })
    }

    console.log(`[QUESTIONNAIRE] ✓ Saved for ${client_domain}`)

    // Trigger KB sync in background (don't wait for it)
    syncQuestionnaireToKB(client_domain).catch(e => {
      console.error(`[QUESTIONNAIRE] Background KB sync failed:`, e)
    })

    return NextResponse.json({ success: true, message: 'Questionnaire saved' })
  } catch (e) {
    console.error('[QUESTIONNAIRE] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

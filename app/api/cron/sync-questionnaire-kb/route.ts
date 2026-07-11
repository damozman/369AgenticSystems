import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncQuestionnaireToKB } from '@/lib/retell-kb-sync'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  // Basic auth: Vercel cron sends Authorization header
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET || ''

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[CRON] Starting KB sync for all questionnaires...')

    // Get all questionnaires that have been completed but not yet synced to KB
    const { data: questionnaires, error } = await supabase
      .from('client_questionnaires')
      .select('client_domain')
      .is('kb_uploaded_at', null)
      .not('completed_at', 'is', null)

    if (error) {
      console.error('[CRON] Query failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!questionnaires || questionnaires.length === 0) {
      console.log('[CRON] No pending questionnaires to sync')
      return NextResponse.json({ synced: 0, message: 'No pending questionnaires' })
    }

    console.log(`[CRON] Found ${questionnaires.length} pending questionnaires`)

    let synced = 0
    let failed = 0

    for (const q of questionnaires) {
      const success = await syncQuestionnaireToKB(q.client_domain)
      if (success) {
        synced++
      } else {
        failed++
      }
    }

    console.log(`[CRON] ✓ Synced ${synced}, failed ${failed}`)
    return NextResponse.json({ synced, failed, total: questionnaires.length })
  } catch (e) {
    console.error('[CRON] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

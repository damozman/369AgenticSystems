import { NextRequest, NextResponse } from 'next/server'
import { runAutoActivation } from '@/lib/auto-activation'

// GET  /api/auto-activation        — run checks across all clients (cron-friendly)
// POST /api/auto-activation        — same, triggered manually or by webhook

// Fails CLOSED: with CRON_SECRET unset, nothing is authorised. This route writes notification rows
// for every client, and it used to run for anyone who requested it. Nothing schedules it today, so
// a caller must present `Authorization: Bearer $CRON_SECRET` — the header Vercel Cron sends.
async function handler(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET || ''
  if (!expectedSecret || request.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAutoActivation()
    console.log(`[AUTO-ACTIVATION] ✓ checked=${result.checked} created=${result.created} skipped=${result.skipped}`)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[AUTO-ACTIVATION] ✗', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export { handler as GET, handler as POST }

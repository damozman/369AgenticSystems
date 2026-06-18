import { NextRequest, NextResponse } from 'next/server'
import { runAutoActivation } from '@/lib/auto-activation'

// GET  /api/auto-activation        — run checks across all clients (cron-friendly)
// POST /api/auto-activation        — same, triggered manually or by webhook

async function handler(_request: NextRequest) {
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

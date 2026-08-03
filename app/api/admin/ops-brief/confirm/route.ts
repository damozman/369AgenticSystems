import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase-admin'
import { computeMetrics } from '@/lib/ops-brief-metrics'
import type { MappingEntry } from '@/lib/ops-brief-mapping'
import type { OpsBriefInput } from '@/lib/ops-brief-schema'

interface ConfirmBody {
  uploadId?: string
  confirmedMapping?: Record<OpsBriefInput, MappingEntry>
}

export async function POST(request: Request) {
  // Middleware doesn't cover /api/:path*, so this route checks admin status itself —
  // see the same note in app/api/admin/ops-brief/upload/route.ts.
  const adminEmail = await requireAdmin()
  if (!adminEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ConfirmBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { uploadId, confirmedMapping } = body
  if (!uploadId || !confirmedMapping) {
    return NextResponse.json({ error: 'uploadId and confirmedMapping are required' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: upload, error: fetchError } = await supabaseAdmin
    .from('ops_uploads')
    .select('client_label, vertical, headers, parsed_rows, detected_header_row')
    .eq('id', uploadId)
    .single()

  if (fetchError || !upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  // Store the confirmed mapping (and header position) for this client+vertical so
  // the next upload from the same source skips the Claude proposal step entirely.
  const { error: upsertError } = await supabaseAdmin
    .from('ops_column_mappings')
    .upsert(
      {
        client_label: upload.client_label,
        vertical: upload.vertical,
        header_row_index: upload.detected_header_row,
        mapping: confirmedMapping,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_label,vertical' }
    )

  if (upsertError) {
    return NextResponse.json({ error: 'Failed to save mapping' }, { status: 500 })
  }

  const metrics = computeMetrics(upload.headers, upload.parsed_rows, confirmedMapping)

  const { error: snapshotError } = await supabaseAdmin.from('ops_metric_snapshots').insert({
    upload_id: uploadId,
    client_label: upload.client_label,
    vertical: upload.vertical,
    metrics,
  })

  if (snapshotError) {
    return NextResponse.json({ error: 'Failed to save metric snapshot' }, { status: 500 })
  }

  return NextResponse.json({ metrics })
}

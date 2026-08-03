import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseRawRows } from '@/lib/ops-brief-parse'
import { proposeColumnMapping } from '@/lib/ops-brief-mapping'
import { computeMetrics } from '@/lib/ops-brief-metrics'

// Middleware only covers page routes (see middleware.ts config.matcher — no /api/:path*
// entry), so this route checks admin status itself. Never remove this check.
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB — these are small ops exports, not bulk data dumps
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls']

export async function POST(request: Request) {
  const adminEmail = await requireAdmin()
  if (!adminEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const clientLabel = ((formData.get('clientLabel') as string | null) ?? '').trim()
  const vertical = ((formData.get('vertical') as string | null) ?? 'wholesale').trim() || 'wholesale'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!clientLabel) return NextResponse.json({ error: 'clientLabel is required' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `File too large — ${MAX_FILE_BYTES / (1024 * 1024)}MB max` }, { status: 400 })
  }
  const lowerName = file.name.toLowerCase()
  if (!ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    return NextResponse.json({ error: 'Only .csv, .xlsx, .xls files are supported' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  let rawRows: string[][]
  try {
    const buffer = await file.arrayBuffer()
    rawRows = parseRawRows(buffer)
  } catch (err) {
    await supabaseAdmin.from('ops_uploads').insert({
      client_label: clientLabel,
      vertical,
      original_filename: file.name,
      parse_status: 'failed',
      error_message: err instanceof Error ? err.message : 'Unknown parse error',
    })
    return NextResponse.json({ error: 'Failed to parse file — see error_message in ops_uploads' }, { status: 400 })
  }

  if (rawRows.length === 0) {
    await supabaseAdmin.from('ops_uploads').insert({
      client_label: clientLabel,
      vertical,
      original_filename: file.name,
      parse_status: 'failed',
      error_message: 'File parsed to zero non-empty rows',
    })
    return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 })
  }

  // If this client+vertical already has a confirmed mapping, reuse it (and its stored
  // header-row position) and skip Claude entirely — this is what makes "client #2
  // upload is nearly free" a real property of the system, not just an aspiration.
  const { data: existingMapping } = await supabaseAdmin
    .from('ops_column_mappings')
    .select('header_row_index, mapping')
    .eq('client_label', clientLabel)
    .eq('vertical', vertical)
    .maybeSingle()

  if (existingMapping) {
    const headerRowIndex = existingMapping.header_row_index
    const headers = rawRows[headerRowIndex] ?? []
    const dataRows = rawRows.slice(headerRowIndex + 1)

    const { data: uploadRow, error: uploadError } = await supabaseAdmin
      .from('ops_uploads')
      .insert({
        client_label: clientLabel,
        vertical,
        original_filename: file.name,
        row_count: dataRows.length,
        detected_header_row: headerRowIndex,
        headers,
        parsed_rows: dataRows,
        parse_status: 'parsed',
      })
      .select('id')
      .single()

    if (uploadError || !uploadRow) {
      return NextResponse.json({ error: 'Failed to save upload' }, { status: 500 })
    }

    const metrics = computeMetrics(headers, dataRows, existingMapping.mapping)
    await supabaseAdmin.from('ops_metric_snapshots').insert({
      upload_id: uploadRow.id,
      client_label: clientLabel,
      vertical,
      metrics,
    })

    return NextResponse.json({
      uploadId: uploadRow.id,
      reusedMapping: true,
      headers,
      metrics,
    })
  }

  // No existing mapping for this client — ask Claude to find the header row and
  // propose a mapping for review before anything is computed or saved as confirmed.
  let proposal
  try {
    proposal = await proposeColumnMapping(rawRows)
  } catch (err) {
    console.error('[OPS-BRIEF] Claude mapping call failed', err)
    return NextResponse.json({ error: 'Column-mapping request failed' }, { status: 502 })
  }

  const dataRows = rawRows.slice(proposal.headerRowIndex + 1)

  const { data: uploadRow, error: uploadError } = await supabaseAdmin
    .from('ops_uploads')
    .insert({
      client_label: clientLabel,
      vertical,
      original_filename: file.name,
      row_count: dataRows.length,
      detected_header_row: proposal.headerRowIndex,
      headers: proposal.headers,
      parsed_rows: dataRows,
      parse_status: 'parsed',
    })
    .select('id')
    .single()

  if (uploadError || !uploadRow) {
    return NextResponse.json({ error: 'Failed to save upload' }, { status: 500 })
  }

  return NextResponse.json({
    uploadId: uploadRow.id,
    reusedMapping: false,
    headerRowIndex: proposal.headerRowIndex,
    headers: proposal.headers,
    sampleRows: dataRows.slice(0, 10),
    proposedMapping: proposal.mapping,
  })
}

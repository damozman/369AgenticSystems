import Anthropic from '@anthropic-ai/sdk'
import { WHOLESALE_INPUT_SCHEMA, type OpsBriefInput } from '@/lib/ops-brief-schema'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MAX_SAMPLE_ROWS = 15

export interface MappingEntry {
  column: string | null
  confidence: number
}

export interface ProposedMapping {
  headerRowIndex: number
  headers: string[]
  mapping: Record<OpsBriefInput, MappingEntry>
}

interface RawClaudeMapping {
  headerRowIndex?: number
  mapping?: Partial<Record<OpsBriefInput, Partial<MappingEntry>>>
}

/**
 * Sends the first ~15 raw rows of a messy export to Claude and asks it to (1) find
 * the real header row (messy exports often have title/spacer rows above it) and
 * (2) propose a mapping from that header's columns onto the wholesale target schema.
 * Mirrors the Anthropic call shape already used in lib/nova-templates.ts.
 */
export async function proposeColumnMapping(rawRows: string[][]): Promise<ProposedMapping> {
  const sample = rawRows.slice(0, MAX_SAMPLE_ROWS)

  const schemaDescription = WHOLESALE_INPUT_SCHEMA.map(
    f => `- "${f.key}" (${f.label}): ${f.description}`
  ).join('\n')

  const rowsText = sample.map((row, i) => `Row ${i}: ${JSON.stringify(row)}`).join('\n')

  const system = `You are a data analyst mapping a messy, real-world business data export onto a fixed target schema. Real exports often have title rows, blank spacer rows, or subtotal rows above the true header row — find the real one, not just row 0.

Respond with ONLY a single JSON object, no markdown code fences, no commentary, exactly this shape:
{
  "headerRowIndex": <integer index into the rows below that is the real header row>,
  "mapping": {
    "<schema_input_key>": { "column": "<exact header text from that row, or null if no good match exists>", "confidence": <number 0 to 1> }
  }
}
Include every input key in "mapping", even ones with no good match (column: null, confidence: 0).`

  const user = `Target input fields to map (a data column may satisfy more than one, or none):
${schemaDescription}

Raw rows from the file (0-indexed):
${rowsText}

Identify the header row and propose the column mapping now.`

  const message = await anthropic.messages.create({
    // Measured 2026-08-04 on the messy wholesale fixture: sonnet-4-6, haiku-4-5
    // and opus-5 (at every effort level) all mapped 10/10 columns and found the
    // same header row. Opus cost 2x Sonnet for an identical result — adaptive
    // thinking judged the task simple enough not to think, so the premium bought
    // nothing. Sonnet is kept over the cheaper Haiku as headroom for a genuinely
    // nastier real export: the failure mode is not a crash, it is a wrong mapping
    // silently producing wrong metrics a client sees.
    //
    // Cost is bounded by the caller, not by this line — the route reuses a saved
    // mapping per client label, so this fires once per client, not per upload.
    model: 'claude-sonnet-4-6',
    // Generous ceiling, not a target: unused output tokens are not billed, and
    // this removes truncation as a failure mode if the model or prompt changes.
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: user }],
  })

  // Opus 5's classifiers can decline a request — HTTP 200 with an empty or
  // partial content array. Without this the caller sees an unparseable-JSON
  // error instead of the actual cause.
  if (message.stop_reason === 'refusal') {
    throw new Error('Claude declined the column-mapping request (stop_reason: refusal)')
  }

  // NOT content[0] — with thinking on, the first block is a thinking block.
  // Indexing position 0 silently yields '' and the JSON parse fails downstream.
  const textBlock = message.content.find(b => b.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : ''
  const parsed = parseJsonResponse(text)

  const mapping = {} as Record<OpsBriefInput, MappingEntry>
  for (const field of WHOLESALE_INPUT_SCHEMA) {
    const entry = parsed?.mapping?.[field.key]
    mapping[field.key] = {
      column: typeof entry?.column === 'string' ? entry.column : null,
      confidence: typeof entry?.confidence === 'number' ? entry.confidence : 0,
    }
  }

  const rawIndex = typeof parsed?.headerRowIndex === 'number' ? parsed.headerRowIndex : 0
  const headerRowIndex = Math.min(Math.max(rawIndex, 0), Math.max(rawRows.length - 1, 0))
  const headers = rawRows[headerRowIndex] ?? []

  return { headerRowIndex, headers, mapping }
}

function parseJsonResponse(text: string): RawClaudeMapping | null {
  // LLM JSON output isn't always clean — strip markdown fences if the model added them anyway.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  try {
    return JSON.parse(cleaned) as RawClaudeMapping
  } catch {
    return null
  }
}

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
    model: 'claude-opus-5',
    // Thinking is ON BY DEFAULT on Opus 5, and max_tokens caps thinking AND the
    // response text together — the old 1024 was sized for the JSON alone and
    // would now truncate mid-answer. Kept adaptive rather than disabled: this
    // reads JSON out of the response text, and Opus 5 with thinking disabled can
    // leak <thinking> tags into that text and break the parse. Effort is left at
    // its default (high); sweep down to medium if cost matters more than the
    // header inference, which is the hard part of this call.
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
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

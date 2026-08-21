/**
 * Merging a client's questionnaire context into their agent prompt.
 *
 * Extracted from `retell-kb-sync.ts` on 2026-08-21 so it can be tested. That module builds a
 * Supabase client at import time, which made its one piece of pure, load-bearing string logic
 * unreachable from a test — and this is logic that silently deleted a live compliance instruction
 * from a real agent, which is exactly the kind that needs tests.
 */

export const CONTEXT_MARKER_START = '\n\n<!-- BUSINESS_CONTEXT_START -->\n'
export const CONTEXT_MARKER_END = '\n<!-- BUSINESS_CONTEXT_END -->'

/**
 * Replace any previously-synced context block, preserving everything around it.
 *
 * Idempotent — safe to call repeatedly, which is the normal case: a client edits their hours
 * months after signup and this runs again.
 *
 * **Anything written AFTER the block survives.** This used to slice from the start marker to the
 * end of the string and discard the remainder, assuming the context block is always last. It is
 * not — scripts append to the prompt too:
 *
 *   - `set-sms-consent.mjs` appends its consent line.
 *   - `set-ai-disclosure.mjs` appends the backstop that answers "am I talking to a robot?", which
 *     is a Texas TRAIGA disclosure.
 *
 * So a client editing their hours quietly stripped a compliance instruction from their own live
 * agent. Nothing errored; the only trace was the line no longer being there. `set-rental-tools.mjs`
 * already inserts *before* the marker for this reason and was never affected.
 *
 * A stale trailing line is recoverable by re-running the script that wrote it. A deleted one is
 * never noticed. That asymmetry is why this preserves rather than truncates.
 */
export function mergePromptWithContext(basePrompt: string, contextSection: string): string {
  const startIdx = basePrompt.indexOf(CONTEXT_MARKER_START)
  if (startIdx === -1) {
    return `${basePrompt}${CONTEXT_MARKER_START}${contextSection}${CONTEXT_MARKER_END}`
  }

  const cleanBase = basePrompt.slice(0, startIdx)

  // Everything past the previous block's END marker came from something other than this sync, so
  // it is carried across. A block with no END marker is malformed — treat the rest as context to
  // be replaced, which is the old behaviour and the safe reading of a corrupted prompt.
  const endIdx = basePrompt.indexOf(CONTEXT_MARKER_END, startIdx)
  const trailing = endIdx === -1 ? '' : basePrompt.slice(endIdx + CONTEXT_MARKER_END.length)

  return `${cleanBase}${CONTEXT_MARKER_START}${contextSection}${CONTEXT_MARKER_END}${trailing}`
}

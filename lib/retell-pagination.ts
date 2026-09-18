/**
 * Read every page of a Retell list endpoint.
 *
 * Retell's versioned list endpoints (`/v2/list-*`, `/v3/list-calls`, `/v3/list-chats`) return
 * `{ items, has_more }` plus a `pagination_key` when there is more. The legacy endpoints returned a
 * bare array and, for calls, silently capped it — a `/v3/list-calls` with no limit answers with
 * **50 items and `has_more: true`**, so a caller that reads `.items` once is reading a truncated
 * list and cannot tell.
 *
 * This fails LOUD in every case that would otherwise be a quiet wrong answer:
 *   - a response that is not `{ items: [...] }` (a bare array here means the caller is still on a
 *     legacy path, which is exactly what should not be papered over)
 *   - `has_more` with no `pagination_key`, or a key that repeats (a cursor that never advances)
 *   - more pages than `maxPages` (a runaway loop, or a list far larger than the caller expects)
 *
 * Pure and dependency-free so the scripts (plain Node) and the app route share one implementation.
 */

export interface RetellPage<T> {
  items?: T[]
  has_more?: boolean
  pagination_key?: string
}

export const DEFAULT_MAX_PAGES = 200

export async function collectPages<T>(
  fetchPage: (paginationKey: string | undefined) => Promise<unknown>,
  opts: { maxPages?: number; label?: string } = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES
  const label = opts.label ?? 'Retell list'
  const all: T[] = []
  const seen = new Set<string>()
  let key: string | undefined

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage(key)

    if (!res || typeof res !== 'object' || Array.isArray(res) || !Array.isArray((res as RetellPage<T>).items)) {
      throw new Error(
        `${label}: expected { items: [...] } but got ${Array.isArray(res) ? 'a bare array (legacy endpoint?)' : typeof res}`,
      )
    }

    const body = res as RetellPage<T>
    all.push(...(body.items as T[]))

    if (!body.has_more) return all

    const next = body.pagination_key
    if (!next) throw new Error(`${label}: has_more is true but no pagination_key was returned (page ${page})`)
    if (seen.has(next)) throw new Error(`${label}: pagination_key repeated — the cursor is not advancing (page ${page})`)
    seen.add(next)
    key = next
  }

  throw new Error(`${label}: still has_more after ${maxPages} pages — refusing to return a truncated list`)
}

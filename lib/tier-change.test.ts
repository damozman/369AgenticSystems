import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * A guard on one decision, not on behaviour: **the upgrade path never infers a client's
 * forwarding number from their Stripe billing record.**
 *
 * Chris's call, 2026-09-20. An earlier version of this path read `stripe.customers.retrieve().phone`
 * and wrote it into `agent_subscriptions.owner_phone`, which makes it the destination of a WARM
 * TRANSFER — a real customer bridged to whoever answers that number. That phone is a billing
 * contact, captured in a purchase that did not include live call transfer and editable in the
 * billing portal since. The forwarding number is now collected deliberately; with none on file the
 * tier still applies, the tool is refused, and the owner is alerted.
 *
 * These are source assertions rather than a call into `applyTierChange`, for a specific reason:
 * `lib/tier-change.ts` imports `lib/retell-transfer-sync.ts`, which throws at module load when
 * RETELL_API_KEY is unset. Importing it here would fail in any environment without live
 * credentials. A comment can be ignored by a future session; a failing test cannot.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const route = read('../app/api/stripe-webhook/route.ts')
const tierChange = read('./tier-change.ts')

test('the subscription-updated path never reads the Stripe customer', () => {
  // `stripe.customers.retrieve` was the exact call that fetched the billing phone.
  assert.ok(
    !/customers\s*\.\s*retrieve/.test(route),
    'app/api/stripe-webhook/route.ts calls customers.retrieve — the billing phone must not be read',
  )
})

test('no fallback-phone plumbing survives in the webhook or the tier change', () => {
  for (const [name, src] of [['route.ts', route], ['tier-change.ts', tierChange]] as const) {
    assert.ok(!/fallbackPhone/.test(src), `${name} still references fallbackPhone`)
    assert.ok(!/phoneBackfilled/.test(src), `${name} still references phoneBackfilled`)
  }
})

test('applyTierChange never writes owner_phone', () => {
  // It may READ the column elsewhere; what it must never do is set one the client did not give.
  assert.ok(
    !/update\(\s*\{[^}]*owner_phone/s.test(tierChange),
    'lib/tier-change.ts writes owner_phone — the forwarding number is collected, never inferred',
  )
})

test('the alert still names the repair command, so a blocked upgrade is actionable', () => {
  // The whole design depends on this: blocking is only acceptable because Chris is told and has a
  // one-line fix. If the command is dropped, blocking becomes silent failure.
  assert.match(route, /sync-transfer-tool\.mjs/)
  assert.match(route, /owner_phone/)
})

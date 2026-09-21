import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decideTransferTool,
  buildTransferTool,
  samePhone,
  looksDialable,
  TRANSFER_TOOL_NAME,
  TRANSFER_RING_DURATION_MS,
} from '@/lib/retell-transfer-tool'

const PHONE = '+18175550100'

// ── The upgrade this whole module exists for ──────────────────────────────────

test('upgrading to Elite with a number on file attaches the tool', () => {
  const d = decideTransferTool({ tier: 'Elite', ownerPhone: PHONE, toolPresent: false })
  assert.equal(d.action, 'attach')
})

test('Starter and Pro never get the tool', () => {
  for (const tier of ['Starter', 'Pro']) {
    assert.equal(decideTransferTool({ tier, ownerPhone: PHONE, toolPresent: false }).action, 'none')
  }
})

test('downgrading from Elite removes it, so no stale promise is left behind', () => {
  for (const tier of ['Pro', 'Starter']) {
    const d = decideTransferTool({ tier, ownerPhone: PHONE, toolPresent: true, toolDestination: PHONE })
    assert.equal(d.action, 'remove', `${tier} should remove`)
  }
})

// ── The constraint: never transfer to nothing ─────────────────────────────────

test('Elite with NO number on file is blocked, not attached', () => {
  const d = decideTransferTool({ tier: 'Elite', ownerPhone: null, toolPresent: false })
  assert.equal(d.action, 'blocked')
  // The caller alerts with this, so it has to name the missing thing.
  assert.match(d.reason, /owner_phone/)
})

test('an empty-string phone is treated as no phone, not as a destination', () => {
  assert.equal(decideTransferTool({ tier: 'Elite', ownerPhone: '', toolPresent: false }).action, 'blocked')
})

test('Elite with no number but a tool already attached is left alone, not stripped', () => {
  // Removing it would take away a working feature the client pays for.
  const d = decideTransferTool({ tier: 'Elite', ownerPhone: null, toolPresent: true, toolDestination: PHONE })
  assert.equal(d.action, 'none')
})

// ── Idempotence: Stripe re-delivers and retries ───────────────────────────────

test('a second delivery of the same upgrade does nothing — no duplicate tool', () => {
  const d = decideTransferTool({ tier: 'Elite', ownerPhone: PHONE, toolPresent: true, toolDestination: PHONE })
  assert.equal(d.action, 'none')
})

test('a repeated downgrade event does nothing once the tool is already gone', () => {
  assert.equal(decideTransferTool({ tier: 'Pro', ownerPhone: PHONE, toolPresent: false }).action, 'none')
})

// ── A changed number has to reach the agent ───────────────────────────────────

test('a tool pointing at the wrong number is re-pointed, not left stale', () => {
  const d = decideTransferTool({
    tier: 'Elite', ownerPhone: PHONE, toolPresent: true, toolDestination: '+18175559999',
  })
  assert.equal(d.action, 'attach')
})

test('the same number formatted differently is not a change', () => {
  const d = decideTransferTool({
    tier: 'Elite', ownerPhone: PHONE, toolPresent: true, toolDestination: '+1 (817) 555-0100',
  })
  assert.equal(d.action, 'none', 'formatting alone must not trigger a rewrite')
})

test('samePhone ignores a US country code, so the same line is not rewritten every delivery', () => {
  assert.ok(samePhone('+18175550100', '817-555-0100'))
  assert.ok(samePhone('+1 (817) 555-0100', '8175550100'))
  assert.ok(!samePhone('+18175550100', '+18175559999'))
})

test('samePhone refuses to call two blanks equal', () => {
  assert.ok(!samePhone(null, null))
  assert.ok(!samePhone('', ''))
  assert.ok(!samePhone(null, PHONE))
})

test('a number too short to ring anyone is blocked, not attached', () => {
  // Same failure as a missing number: the agent promises a person, then fails mid-call.
  const d = decideTransferTool({ tier: 'Elite', ownerPhone: '555', toolPresent: false })
  assert.equal(d.action, 'blocked')
  assert.match(d.reason, /not a dialable number/)
})

test('looksDialable accepts real US numbers in any format and rejects fragments', () => {
  assert.ok(looksDialable('+18175550100'))
  assert.ok(looksDialable('817-555-0100'))
  assert.ok(!looksDialable('555-0100'))
  assert.ok(!looksDialable(null))
})

// ── An unknown or missing tier must not be treated as Elite ───────────────────

test('a null, empty or unrecognised tier is not Elite', () => {
  for (const tier of [null, undefined, '', 'elite', 'ELITE', 'Enterprise']) {
    const d = decideTransferTool({ tier, ownerPhone: PHONE, toolPresent: false })
    assert.equal(d.action, 'none', `${String(tier)} must not attach`)
  }
})

test('every decision carries a reason — a refusal nobody can see is the bug this prevents', () => {
  const cases: Array<Parameters<typeof decideTransferTool>[0]> = [
    { tier: 'Elite', ownerPhone: PHONE, toolPresent: false },
    { tier: 'Elite', ownerPhone: null, toolPresent: false },
    { tier: 'Pro', ownerPhone: PHONE, toolPresent: true, toolDestination: PHONE },
    { tier: 'Starter', ownerPhone: null, toolPresent: false },
  ]
  for (const c of cases) assert.ok(decideTransferTool(c).reason.length > 20)
})

// ── The tool itself ───────────────────────────────────────────────────────────

test('the built tool carries the proven configuration', () => {
  const t = buildTransferTool(PHONE)
  assert.equal(t.type, 'transfer_call')
  assert.equal(t.name, TRANSFER_TOOL_NAME)
  assert.equal(t.transfer_destination.number, PHONE)
  assert.equal(t.transfer_option.type, 'warm_transfer')
  assert.equal(t.transfer_option.transfer_ring_duration_ms, TRANSFER_RING_DURATION_MS)
  assert.equal(TRANSFER_RING_DURATION_MS, 30000, '30s was proven on a real call — do not change silently')
  assert.equal(t.transfer_option.private_handoff_option.type, 'prompt')
})

test('the tool tells the agent to warn the caller before transferring', () => {
  // A caller dropped into a transfer with no warning is the failure this sentence prevents.
  assert.match(buildTransferTool(PHONE).description, /let the caller know/i)
})

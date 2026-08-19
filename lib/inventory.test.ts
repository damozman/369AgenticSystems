import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeChoices, deriveItemKey, matchItem, normalise, type InventoryItem } from './inventory.ts'

/**
 * The failure these guard against is booking the wrong unit. It is discovered when a van arrives
 * at a child's birthday party with the wrong thing on it, which is not a failure you get to
 * apologise your way out of — so ambiguity refuses rather than guesses.
 */

const ITEMS: InventoryItem[] = [
  { item_key: 'princess-castle',  label: 'Princess Castle',        quantity: 1 },
  { item_key: 'castle-combo',     label: 'Castle Combo',           quantity: 2 },
  { item_key: 'obstacle-course',  label: 'Obstacle Course',        quantity: 1 },
  { item_key: 'casino-package',   label: 'Mobile Casino Package',  quantity: 1 },
]

// ── normalisation ─────────────────────────────────────────────────────────────

test('the same unit heard three ways normalises to one thing', () => {
  // ASR renders this differently on every call. None of these should be distinct answers.
  assert.equal(normalise('Princess Castle'),   'princess castle')
  assert.equal(normalise('princess-castle'),   'princess castle')
  assert.equal(normalise('  the PRINCESS,  castle. '), 'the princess castle')
})

// ── exact matching ────────────────────────────────────────────────────────────

test('the stable key matches, which is how a re-offered item comes back', () => {
  const m = matchItem(ITEMS, 'princess-castle')
  assert.equal(m.kind, 'match')
  assert.equal((m as { item: InventoryItem }).item.item_key, 'princess-castle')
})

test('the spoken label matches, with or without a leading article', () => {
  for (const spoken of ['Princess Castle', 'the princess castle', 'THE Princess Castle!']) {
    const m = matchItem(ITEMS, spoken)
    assert.equal(m.kind, 'match', `"${spoken}" should match`)
    assert.equal((m as { item: InventoryItem }).item.item_key, 'princess-castle')
  }
})

test('a partial name finds the item', () => {
  const m = matchItem(ITEMS, 'obstacle')
  assert.equal(m.kind, 'match')
  assert.equal((m as { item: InventoryItem }).item.item_key, 'obstacle-course')
})

test('a caller who over-describes still matches', () => {
  // "I want the mobile casino package for a party" — more words than the label.
  const m = matchItem(ITEMS, 'mobile casino package')
  assert.equal(m.kind, 'match')
  assert.equal((m as { item: InventoryItem }).item.item_key, 'casino-package')
})

// ── the important one: never guess ────────────────────────────────────────────

test('an ambiguous word refuses rather than picking the first', () => {
  // "castle" fits both Princess Castle and Castle Combo. Picking either sends the wrong van.
  const m = matchItem(ITEMS, 'castle')
  assert.equal(m.kind, 'ambiguous')
  const candidates = (m as { candidates: InventoryItem[] }).candidates
  assert.equal(candidates.length, 2)
})

test('an exact match beats an ambiguous partial', () => {
  // "Castle Combo" is exact, even though "castle" alone would be ambiguous.
  const m = matchItem(ITEMS, 'Castle Combo')
  assert.equal(m.kind, 'match')
  assert.equal((m as { item: InventoryItem }).item.item_key, 'castle-combo')
})

test('something we do not stock is "none", not a near miss', () => {
  assert.equal(matchItem(ITEMS, 'petting zoo').kind, 'none')
})

test('empty and missing input never match anything', () => {
  for (const spoken of ['', '   ', null, undefined, '...']) {
    assert.equal(matchItem(ITEMS, spoken).kind, 'none', `${JSON.stringify(spoken)} should not match`)
  }
})

test('a client with no inventory matches nothing rather than throwing', () => {
  // This is every existing client — roofing, legal, plumbing. They book people-time.
  assert.equal(matchItem([], 'anything').kind, 'none')
})

// ── reading choices back ──────────────────────────────────────────────────────

test('choices read back as a sentence Ava can say', () => {
  assert.equal(describeChoices(ITEMS.slice(0, 2)), 'Princess Castle or Castle Combo')
  assert.equal(describeChoices(ITEMS.slice(0, 3)), 'Princess Castle, Castle Combo or Obstacle Course')
  assert.equal(describeChoices(ITEMS.slice(0, 1)), 'Princess Castle')
  assert.equal(describeChoices([]), '')
})

test('deriveItemKey is stable, lowercase and safe for the DB check constraint', () => {
  assert.equal(deriveItemKey('Princess Castle bounce house'), 'princess_castle_bounce_house')
  assert.equal(deriveItemKey('  Blackjack Table  '), 'blackjack_table')
  assert.equal(deriveItemKey("Sandra's 20ft Slide!"), 'sandra_s_20ft_slide')
  // The DB requires item_key = lower(item_key) and item_key <> ''.
  for (const label of ['ABC', 'a b c', '  x  ', 'Café Table', '20ft']) {
    const key = deriveItemKey(label)
    assert.equal(key, key.toLowerCase(), `${label} must produce a lowercase key`)
    assert.notEqual(key, '', `${label} must produce a non-empty key`)
  }
})

test('deriveItemKey collides only when the labels are genuinely the same words', () => {
  assert.equal(deriveItemKey('Bounce House'), deriveItemKey('bounce-house'))
  assert.notEqual(deriveItemKey('Princess Castle'), deriveItemKey('Castle Combo'))
})

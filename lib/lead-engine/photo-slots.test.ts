/**
 * `PHOTO_SLOTS` must match the CHECK constraint in the migration.
 *
 * The same guard shape as `theme.test.ts`, for the same reason and at the same cost. The forge kit
 * shipped in code with the constraint still listing six themes, and createSite failed outright for
 * eleven verticals — `tsc` was clean, the suite was green, and only a script that actually inserted
 * a row could notice. Nothing connects a TypeScript union to a Postgres CHECK except a test that
 * reads both.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { PHOTO_SLOTS } from '@/lib/lead-engine/types'

function constraintValues(name: string): string[] {
  const dir = 'supabase/migrations'
  let latest: string[] | null = null
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.sql')) continue
    const sql = readFileSync(`${dir}/${file}`, 'utf8')
    const m = sql.match(new RegExp(`CONSTRAINT\\s+${name}[\\s\\S]*?CHECK\\s*\\(([\\s\\S]*?)\\)\\s*;`, 'i'))
    if (m) latest = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])
  }
  assert.ok(latest, `no ${name} constraint found in ${dir}`)
  return latest!
}

test('every slot the code can write is allowed by the database', () => {
  const allowed = new Set(constraintValues('lead_engine_photos_slot_check'))
  for (const slot of PHOTO_SLOTS) {
    assert.ok(allowed.has(slot), `PHOTO_SLOTS has "${slot}" but the CHECK constraint does not allow it`)
  }
})

test('the constraint allows nothing the code does not know about', () => {
  const known = new Set<string>(PHOTO_SLOTS)
  for (const v of constraintValues('lead_engine_photos_slot_check')) {
    assert.ok(known.has(v), `the CHECK allows "${v}", which PHOTO_SLOTS does not list`)
  }
})

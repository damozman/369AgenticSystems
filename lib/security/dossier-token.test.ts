import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mintDossierToken, verifyDossierToken, dossierReviewUrl } from '@/lib/security/dossier-token'

process.env.ONBOARDING_TOKEN_SECRET ||= 'test-secret-for-dossier-tokens'
const ID = 'd1f0c0de-0000-4000-8000-000000000001'

test('a freshly minted token verifies', () => {
  assert.deepEqual(verifyDossierToken(mintDossierToken(ID), ID), { valid: true })
})

test('a token for one dossier cannot approve another', () => {
  // A gate that only proves "someone once received an email from us" is not a gate.
  const t = mintDossierToken(ID)
  const other = 'd1f0c0de-0000-4000-8000-000000000002'
  assert.equal(verifyDossierToken(t, other).valid, false)
})

test('a tampered signature is rejected', () => {
  const t = mintDossierToken(ID)!
  const [exp, sig] = t.split('.')
  const flipped = sig[0] === 'a' ? 'b' : 'a'
  assert.equal(verifyDossierToken(`${exp}.${flipped}${sig.slice(1)}`, ID).valid, false)
})

test('an extended expiry does not extend the token', () => {
  // The expiry is signed, so moving it invalidates the signature rather than buying more time.
  const t = mintDossierToken(ID)!
  const [exp, sig] = t.split('.')
  const later = String(Number(exp) + 86_400)
  const r = verifyDossierToken(`${later}.${sig}`, ID)
  assert.equal(r.valid, false)
  assert.equal(r.valid === false && r.reason, 'bad-signature')
})

test('an expired token is refused', () => {
  const r = verifyDossierToken(mintDossierToken(ID, -60), ID)
  assert.equal(r.valid, false)
  assert.equal(r.valid === false && r.reason, 'expired')
})

test('malformed and missing tokens are distinguished, not lumped together', () => {
  assert.equal((verifyDossierToken(null, ID) as { reason: string }).reason, 'missing')
  assert.equal((verifyDossierToken('nonsense', ID) as { reason: string }).reason, 'malformed')
  assert.equal((verifyDossierToken('abc.def', ID) as { reason: string }).reason, 'malformed')
})

test('the review URL carries the token and the id', () => {
  const url = dossierReviewUrl(ID, 'https://example.com')!
  assert.ok(url.startsWith(`https://example.com/dossier/review/${ID}?t=`))
})

test('with no secret configured nothing is minted and nothing verifies', () => {
  const saved = process.env.ONBOARDING_TOKEN_SECRET
  const savedOwn = process.env.DOSSIER_TOKEN_SECRET
  delete process.env.ONBOARDING_TOKEN_SECRET
  delete process.env.DOSSIER_TOKEN_SECRET
  try {
    // Returning null lets a caller refuse to send a link rather than mail one containing "null".
    assert.equal(mintDossierToken(ID), null)
    assert.equal(dossierReviewUrl(ID), null)
    const r = verifyDossierToken('anything', ID)
    assert.equal(r.valid, false)
    assert.equal(r.valid === false && r.reason, 'not-configured')
  } finally {
    if (saved) process.env.ONBOARDING_TOKEN_SECRET = saved
    if (savedOwn) process.env.DOSSIER_TOKEN_SECRET = savedOwn
  }
})

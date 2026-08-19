import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.ONBOARDING_TOKEN_SECRET = 'test-secret-for-onboarding-tokens'

const {
  mintOnboardingToken,
  verifyOnboardingToken,
  questionnaireUrl,
  ONBOARDING_TOKEN_TTL_SECONDS,
} = await import('./onboarding-token.ts')

/**
 * These guard the two failures that matter: a token that authorises the wrong client, and a
 * gate that can be talked past. Everything else about this route is recoverable; a stranger
 * rewriting a client's live agent prompt is not.
 */

const DOMAIN = 'example-client.com'

test('a freshly minted token verifies for its own domain', () => {
  const token = mintOnboardingToken(DOMAIN)
  assert.ok(token)
  assert.deepEqual(verifyOnboardingToken(token, DOMAIN), { valid: true })
})

test('a token for one client does NOT authorise another', () => {
  const token = mintOnboardingToken(DOMAIN)
  const check = verifyOnboardingToken(token, 'someone-elses-domain.com')
  assert.equal(check.valid, false)
  assert.equal(check.valid === false && check.reason, 'bad-signature')
})

test('a missing token is refused', () => {
  assert.equal(verifyOnboardingToken(undefined, DOMAIN).valid, false)
  assert.equal(verifyOnboardingToken('', DOMAIN).valid, false)
  assert.equal(verifyOnboardingToken(null, DOMAIN).valid, false)
})

test('rubbish is refused rather than throwing', () => {
  for (const bad of ['nonsense', '.', 'abc.def', '123', '..', 'x.y.z']) {
    const check = verifyOnboardingToken(bad, DOMAIN)
    assert.equal(check.valid, false, `${bad} must not verify`)
  }
})

test('an expired token is refused', () => {
  const token = mintOnboardingToken(DOMAIN, -60) // minted already expired
  assert.equal(verifyOnboardingToken(token, DOMAIN).valid, false)
  const check = verifyOnboardingToken(token, DOMAIN)
  assert.equal(check.valid === false && check.reason, 'expired')
})

test('the expiry cannot be extended by editing the URL', () => {
  // The expiry is inside the signed payload, so moving it invalidates the signature rather
  // than buying more time.
  const token = mintOnboardingToken(DOMAIN, -60)
  const [, sig] = token.split('.')
  const forged = `${Math.floor(Date.now() / 1000) + 9999}.${sig}`
  const check = verifyOnboardingToken(forged, DOMAIN)
  assert.equal(check.valid, false)
  assert.equal(check.valid === false && check.reason, 'bad-signature')
})

test('a flipped signature byte is refused', () => {
  const token = mintOnboardingToken(DOMAIN)
  const [exp, sig] = token.split('.')
  const flipped = sig[0] === 'a' ? 'b' + sig.slice(1) : 'a' + sig.slice(1)
  assert.equal(verifyOnboardingToken(`${exp}.${flipped}`, DOMAIN).valid, false)
})

test('a truncated signature is refused rather than throwing on length', () => {
  const token = mintOnboardingToken(DOMAIN)
  const [exp, sig] = token.split('.')
  const check = verifyOnboardingToken(`${exp}.${sig.slice(0, 10)}`, DOMAIN)
  assert.equal(check.valid, false)
  assert.equal(check.valid === false && check.reason, 'bad-signature')
})

test('the TTL is long enough that a slow client is not locked out', () => {
  // A client who fills the form three weeks after signing up must still get in.
  assert.ok(ONBOARDING_TOKEN_TTL_SECONDS >= 30 * 24 * 60 * 60)
})

test('questionnaireUrl carries a token that verifies for that domain', () => {
  const url = questionnaireUrl(DOMAIN)
  const token = decodeURIComponent(new URL(url).searchParams.get('t') ?? '')
  assert.deepEqual(verifyOnboardingToken(token, DOMAIN), { valid: true })
  assert.ok(url.includes(`/onboarding/questionnaire/${DOMAIN}`))
})

test('with no secret configured, nothing is minted and nothing verifies', async () => {
  const saved = process.env.ONBOARDING_TOKEN_SECRET
  delete process.env.ONBOARDING_TOKEN_SECRET
  try {
    assert.equal(mintOnboardingToken(DOMAIN), null)
    // Fails closed: an unconfigured secret must never read as "valid".
    const check = verifyOnboardingToken('anything', DOMAIN)
    assert.equal(check.valid, false)
    assert.equal(check.valid === false && check.reason, 'not-configured')
    // And the URL is still usable, just unsigned, rather than containing "null".
    assert.ok(!questionnaireUrl(DOMAIN).includes('null'))
  } finally {
    process.env.ONBOARDING_TOKEN_SECRET = saved
  }
})

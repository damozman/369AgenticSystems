import { test } from 'node:test'
import assert from 'node:assert/strict'
import { noFollowUpChannelReason } from '@/lib/rex-channel'

const base = { hasEmail: false, hasPhone: true, smsConfigured: true, smsConsented: true }

test('an email lead always has a channel, whatever SMS state is', () => {
  assert.equal(noFollowUpChannelReason({ ...base, hasEmail: true, smsConfigured: false, smsConsented: false }), null)
})

test('a phone-only lead with SMS configured and consent has a channel', () => {
  assert.equal(noFollowUpChannelReason(base), null)
})

test('a phone-only lead with SMS unconfigured has no channel', () => {
  assert.equal(noFollowUpChannelReason({ ...base, smsConfigured: false }), 'sms_not_configured')
})

test('a phone-only lead with no consent has no channel EVEN WHEN SMS is configured', () => {
  // The hole: this used to fall through and retry daily forever once Twilio existed.
  assert.equal(noFollowUpChannelReason({ ...base, smsConsented: false }), 'no_sms_consent')
})

test('unconfigured is reported ahead of missing consent — the deployment problem is the truer cause', () => {
  assert.equal(noFollowUpChannelReason({ ...base, smsConfigured: false, smsConsented: false }), 'sms_not_configured')
})

test('a lead with no contact info at all is not an alert — the caller handles it', () => {
  assert.equal(noFollowUpChannelReason({ ...base, hasPhone: false }), null)
})

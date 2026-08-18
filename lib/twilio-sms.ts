/**
 * Twilio SMS integration for Pro/Elite follow-up sequences.
 *
 * Nothing leaves this file without recorded consent — see `SendSmsInput.consent`.
 */

import type { SmsConsent } from '@/lib/sms-consent'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || ''

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
  console.warn('[TWILIO] SMS not configured (missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER)')
}

export interface SendSmsInput {
  toPhone:   string
  message:   string
  trackingId?: string  // call_id or lead_id for auditing
  /**
   * Proof this recipient agreed to be texted. **Required, and not defaultable.**
   *
   * A2P 10DLC campaigns are rejected on proof of opt-in more than on anything else, and "they
   * called us" is not consent. Making this a required argument means the compiler asks the
   * question at every call site — which is stronger than a runtime check someone has to remember,
   * and the repo's own lesson is that one-sided adoption always leaves a window.
   *
   * Build it with `consentForLead()`; use `noConsent()` only where there is genuinely no lead, and
   * expect the send to be refused.
   */
  consent:   SmsConsent
}

/**
 * Send an SMS via Twilio
 */
export async function sendSms(input: SendSmsInput): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { toPhone, message, trackingId, consent } = input

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.error('[SMS] Twilio not configured')
    return { success: false, error: 'Twilio not configured' }
  }

  if (!toPhone || !message) {
    return { success: false, error: 'Missing toPhone or message' }
  }

  // The gate. Every path into Twilio passes through here, which is the whole point of putting it
  // in this function rather than in the three routes that call it.
  if (!consent?.granted) {
    console.warn(`[SMS] Refused — ${consent?.reason ?? 'no consent object supplied'}${trackingId ? ` [${trackingId}]` : ''}`)
    return { success: false, error: `No consent to text this recipient: ${consent?.reason ?? 'none supplied'}` }
  }

  try {
    // Format phone number: ensure it starts with + and country code
    const formattedPhone = toPhone.startsWith('+') ? toPhone : `+1${toPhone.replace(/\D/g, '')}`

    const bodyParams = new URLSearchParams({
      From: TWILIO_FROM_NUMBER,
      To: formattedPhone,
      Body: message,
    })

    const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + TWILIO_ACCOUNT_SID + '/Messages.json', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error(`[SMS] Twilio error (${response.status}):`, errorData)
      return { success: false, error: `Twilio error: ${response.status}` }
    }

    const data = await response.json() as { sid?: string; error_message?: string }
    const messageId = data.sid

    if (!messageId) {
      console.error('[SMS] No message ID returned')
      return { success: false, error: 'No message ID returned' }
    }

    console.log(`[SMS] ✓ Message sent to ${formattedPhone} (ID: ${messageId})${trackingId ? ` [${trackingId}]` : ''}`)

    return { success: true, messageId }
  } catch (error) {
    console.error('[SMS] Unexpected error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Allocate a new SMS phone number from Twilio
 * Returns a Twilio phone number for dedicated SMS use
 */
export async function allocateSmsNumber(areaCode?: string): Promise<string | null> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('[SMS] Twilio not configured')
    return null
  }

  try {
    const queryParams = new URLSearchParams({
      AreaCode: areaCode || '972',  // default to DFW
      Limit: '1',
    })

    const searchResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/AvailablePhoneNumbers/US/Local.json?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
      }
    )

    if (!searchResponse.ok) {
      console.error('[SMS] Failed to search available numbers')
      return null
    }

    const searchData = await searchResponse.json() as { available_phone_numbers?: Array<{ phone_number?: string }> }
    const availableNumbers = searchData.available_phone_numbers || []

    if (availableNumbers.length === 0) {
      console.error('[SMS] No available numbers found')
      return null
    }

    const phoneToProvision = availableNumbers[0].phone_number
    if (!phoneToProvision) {
      return null
    }

    // Purchase the number
    const provisionParams = new URLSearchParams({
      PhoneNumber: phoneToProvision,
      FriendlyName: `SMS-Dedicated-${Date.now()}`,
    })

    const provisionResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: provisionParams.toString(),
      }
    )

    if (!provisionResponse.ok) {
      console.error('[SMS] Failed to provision number')
      return null
    }

    const provisionData = await provisionResponse.json() as { phone_number?: string }
    const provisioned = provisionData.phone_number

    if (provisioned) {
      console.log(`[SMS] ✓ Allocated SMS number: ${provisioned}`)
    }

    return provisioned || null
  } catch (error) {
    console.error('[SMS] Error allocating number:', error)
    return null
  }
}

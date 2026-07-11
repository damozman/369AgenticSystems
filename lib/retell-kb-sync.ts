/**
 * Sync questionnaire to Retell agent Knowledge Base
 */

import { createClient } from '@supabase/supabase-js'
import { questionnaireToKB, formatForRetellAPI, type Questionnaire } from '@/lib/questionnaire-to-kb'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

if (!RETELL_API_KEY) {
  throw new Error('RETELL_API_KEY is not configured')
}

export async function syncQuestionnaireToKB(clientDomain: string): Promise<boolean> {
  try {
    console.log(`[KB-SYNC] Syncing questionnaire for ${clientDomain}...`)

    // 1. Get subscription to find agent ID
    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('retell_agent_id')
      .eq('client_domain', clientDomain)
      .single()

    if (subError || !subscription?.retell_agent_id) {
      console.error(`[KB-SYNC] No agent found for ${clientDomain}`)
      return false
    }

    const agentId = subscription.retell_agent_id

    // 2. Get questionnaire responses
    const { data: questionnaire, error: questError } = await supabase
      .from('client_questionnaires')
      .select('*')
      .eq('client_domain', clientDomain)
      .single()

    if (questError) {
      console.error(`[KB-SYNC] No questionnaire found for ${clientDomain}`)
      return false
    }

    // 3. Transform to KB entries
    const kbEntries = questionnaireToKB(questionnaire)
    const kbPayload = formatForRetellAPI(kbEntries)

    console.log(`[KB-SYNC] Uploading ${kbEntries.length} KB entries to agent ${agentId}...`)

    // 4. Upload to Retell via direct API (SDK doesn't support KB updates yet)
    try {
      await syncViaDirectAPI(agentId, kbPayload)
    } catch (e) {
      console.error(`[KB-SYNC] Failed to upload KB:`, e)
      throw e
    }

    // 5. Mark as synced in Supabase
    const { error: updateError } = await supabase
      .from('client_questionnaires')
      .update({ kb_uploaded_at: new Date().toISOString() })
      .eq('client_domain', clientDomain)

    if (updateError) {
      console.error(`[KB-SYNC] Failed to mark as synced:`, updateError.message)
    }

    console.log(`[KB-SYNC] ✓ KB synced for ${clientDomain}`)
    return true
  } catch (e) {
    console.error(`[KB-SYNC] Error:`, e)
    return false
  }
}

/**
 * Fallback: Direct API call to Retell (if SDK doesn't support KB updates)
 */
async function syncViaDirectAPI(agentId: string, kbPayload: any): Promise<void> {
  const https = await import('https')

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      agent_id: agentId,
      ...kbPayload,
    })

    const options = {
      hostname: 'api.retellai.com',
      port: 443,
      path: `/v2/agents/${agentId}/knowledge-base`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
        } else {
          reject(new Error(`Retell API error: ${res.statusCode} ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

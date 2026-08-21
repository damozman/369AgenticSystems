/**
 * Sync questionnaire answers into the client's own Retell LLM prompt.
 *
 * Originally this posted to a knowledge-base endpoint that doesn't exist in the
 * real Retell API (`/v2/agents/{id}/knowledge-base` — 404 on every call since it
 * was built). Now that provisioning gives each client their own LLM clone (see
 * lib/retell-provisioning.ts), the simpler and correct fix is to merge the
 * questionnaire answers directly into that client's general_prompt — no
 * knowledge-base API needed, and no risk of leaking one client's business
 * context into another's, since each client has an independent LLM.
 */

import { Retell } from 'retell-sdk'
import { createClient } from '@supabase/supabase-js'
import { questionnaireToKB, type Questionnaire } from '@/lib/questionnaire-to-kb'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
if (!RETELL_API_KEY) {
  throw new Error('RETELL_API_KEY is not configured')
}

const client = new Retell({ apiKey: RETELL_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

import { mergePromptWithContext } from '@/lib/prompt-merge'

export async function syncQuestionnaireToKB(clientDomain: string): Promise<boolean> {
  try {
    console.log(`[KB-SYNC] Syncing questionnaire for ${clientDomain}...`)

    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('retell_agent_id')
      .eq('client_domain', clientDomain)
      .single()

    if (subError || !subscription?.retell_agent_id) {
      console.error(`[KB-SYNC] No agent found for ${clientDomain}`)
      return false
    }

    const { data: questionnaire, error: questError } = await supabase
      .from('client_questionnaires')
      .select('*')
      .eq('client_domain', clientDomain)
      .single()

    if (questError || !questionnaire) {
      console.error(`[KB-SYNC] No questionnaire found for ${clientDomain}`)
      return false
    }

    const entries = questionnaireToKB(questionnaire as Questionnaire)
    const contextSection = entries
      .map(e => `## ${e.title}\n${e.content}`)
      .join('\n\n')

    const agent = await client.agent.retrieve(subscription.retell_agent_id)
    if (agent.response_engine?.type !== 'retell-llm') {
      console.error(`[KB-SYNC] Agent ${subscription.retell_agent_id} is not a retell-llm agent`)
      return false
    }

    const llm = await client.llm.retrieve(agent.response_engine.llm_id)
    const mergedPrompt = mergePromptWithContext(llm.general_prompt || '', contextSection)

    await client.llm.update(llm.llm_id, { general_prompt: mergedPrompt })
    console.log(`[KB-SYNC] ✓ Merged ${entries.length} context entries into ${llm.llm_id}`)

    const { error: updateError } = await supabase
      .from('client_questionnaires')
      .update({ kb_uploaded_at: new Date().toISOString() })
      .eq('client_domain', clientDomain)

    if (updateError) {
      console.error(`[KB-SYNC] Failed to mark as synced:`, updateError.message)
    }

    console.log(`[KB-SYNC] ✓ Synced for ${clientDomain}`)
    return true
  } catch (e) {
    console.error(`[KB-SYNC] Error:`, e)
    return false
  }
}

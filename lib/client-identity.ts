/**
 * The name a client's business goes out under.
 *
 * Needed in two places that must agree: the text messages Rex sends ("This is {business}"), and
 * the A2P 10DLC Brand registered for that client under the ISV model. If those two ever disagree,
 * the message is sent under a brand that does not match it — which is both a review failure and,
 * to the person holding the phone, a message from a company they have never heard of.
 *
 * `agent_subscriptions.business_name` is the source. Deliberately not `clients.company_name`:
 * that table is keyed by email, the one row present has a null name, and the subscription is what
 * actually owns the phone number and the agent.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the business name, or `null` when none is recorded.
 *
 * Null is a real answer and callers must handle it — `renderRexSms` substitutes a neutral phrase
 * rather than leaving a literal placeholder or naming us instead of the client. Do not default it
 * to the client domain: "www.northsideroofing.com" read aloud in a text message is worse than a
 * generic phrase, and it hides the missing data instead of surfacing it.
 */
export async function businessNameFor(
  supabase: SupabaseClient,
  clientDomain: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('agent_subscriptions')
    .select('business_name')
    .eq('client_domain', clientDomain)
    .maybeSingle<{ business_name: string | null }>()

  if (error) {
    console.error(`[IDENTITY] Could not read business name for ${clientDomain}: ${error.message}`)
    return null
  }

  const name = (data?.business_name ?? '').trim()
  if (!name) {
    console.warn(`[IDENTITY] ⚠  No business_name recorded for ${clientDomain} — messages will use a generic phrase`)
    return null
  }

  return name
}

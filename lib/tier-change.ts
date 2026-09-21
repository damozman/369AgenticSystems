/**
 * Apply a tier change that happened in Stripe to the client it belongs to.
 *
 * Until now nothing did this. The webhook handled `checkout.session.completed` and nothing else,
 * and a plan change made in Stripe's billing portal never creates a checkout session — so a client
 * could upgrade, be billed $750, and have our database still say Starter. Everything that reads
 * `agent_subscriptions.tier` stayed wrong with it: Elite transcript search kept refusing them
 * (`app/api/search-transcripts/route.ts`), overage kept billing at the Starter rate
 * (`lib/billing.ts`), and Live Call Transfer — the tier's headline feature — was never attached,
 * because the only code that attached it ran at purchase time.
 *
 * The route stays thin; every decision that could mis-grade a paying client lives here or in
 * `lib/retell-transfer-tool.ts`, the same split as `lib/billing.ts` and `/api/cron/usage-bill`.
 */

import { createClient } from '@supabase/supabase-js'
import type { TierName } from '@/lib/tier-config'
import { syncTransferToolForClient, type TransferSyncResult } from '@/lib/retell-transfer-sync'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TierChangeInput {
  stripeSubscriptionId: string
  stripeCustomerId?: string | null
  tier: TierName
}

export interface TierChangeResult {
  clientDomain: string | null
  previousTier: string | null
  newTier: string
  /** True when the stored tier actually moved. False on a redelivery or an unrelated update. */
  tierChanged: boolean
  transfer: TransferSyncResult | null
  /** Something a person has to look at: no client matched, a failed write, or a blocked transfer. */
  needsAttention: boolean
  reason: string
}

export async function applyTierChange(input: TierChangeInput): Promise<TierChangeResult> {
  const base = {
    clientDomain: null, previousTier: null, newTier: input.tier,
    tierChanged: false, transfer: null,
  }

  // Match on the subscription id first. Fall back to the customer id, because a client onboarded
  // before stripe_subscription_id was stored has only the customer — Northside is exactly this.
  let row: { client_domain: string; tier: string | null } | null = null

  const bySubscription = await supabase
    .from('agent_subscriptions')
    .select('client_domain, tier')
    .eq('stripe_subscription_id', input.stripeSubscriptionId)
    .maybeSingle()

  if (bySubscription.error) {
    return { ...base, needsAttention: true, reason: `Could not query by subscription id: ${bySubscription.error.message}` }
  }
  row = bySubscription.data

  if (!row && input.stripeCustomerId) {
    const byCustomer = await supabase
      .from('agent_subscriptions')
      .select('client_domain, tier')
      .eq('stripe_customer_id', input.stripeCustomerId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (byCustomer.error) {
      return { ...base, needsAttention: true, reason: `Could not query by customer id: ${byCustomer.error.message}` }
    }
    row = byCustomer.data?.[0] ?? null
  }

  if (!row) {
    // Not silently ignored: a plan change we cannot attribute is a client being billed for
    // something we have not given them.
    return {
      ...base,
      needsAttention: true,
      reason: `No agent_subscriptions row matches subscription ${input.stripeSubscriptionId}`
            + `${input.stripeCustomerId ? ` or customer ${input.stripeCustomerId}` : ''}. `
            + 'If this is a real client, their tier and Live Call Transfer are now out of date.',
    }
  }

  const clientDomain = row.client_domain
  const previousTier = row.tier
  const tierChanged = previousTier !== input.tier

  if (tierChanged) {
    const { error } = await supabase
      .from('agent_subscriptions')
      .update({ tier: input.tier })
      .eq('client_domain', clientDomain)

    if (error) {
      // The tier drives billing and feature gating, so a failed write is worth a retry from
      // Stripe. The caller turns this into a non-2xx.
      return {
        ...base, clientDomain, previousTier, tierChanged: false,
        needsAttention: true,
        reason: `Could not write tier ${input.tier} for ${clientDomain}: ${error.message}`,
      }
    }
    console.log(`[TIER-CHANGE] ${clientDomain}: ${previousTier ?? 'unset'} → ${input.tier}`)
  }

  // Run every time, not only when the tier moved. This is what makes a previously failed or
  // blocked attach self-healing: once a number is finally on file, the next delivery completes it.
  const transfer = await syncTransferToolForClient(clientDomain)

  return {
    clientDomain, previousTier, newTier: input.tier, tierChanged, transfer,
    needsAttention: transfer.needsAttention,
    reason: tierChanged
      ? `Tier ${previousTier ?? 'unset'} → ${input.tier}. Transfer tool: ${transfer.action} — ${transfer.reason}`
      : `Tier already ${input.tier}, no change. Transfer tool: ${transfer.action} — ${transfer.reason}`,
  }
}

/**
 * Elite's Live Call Transfer tool — the single definition, and the rule for when it applies.
 *
 * This tool used to exist only inside `lib/retell-provisioning.ts`, attached at purchase time and
 * nowhere else. A client who bought Starter or Pro and later upgraded to Elite never received it:
 * the tier's headline feature silently did not exist for them, and nothing anywhere said so.
 *
 * Both writers — initial provisioning and a later tier change — now build the tool from
 * `buildTransferTool` here, so the two cannot drift into configuring transfers differently.
 *
 * Pure on purpose: no Retell client, no database, no env vars. The decision below is the part that
 * can silently do the wrong thing to a paying client, so it is provable by a unit test.
 * `lib/retell-transfer-sync.ts` is the half that talks to Retell.
 */

/** The tool's name on the LLM's `general_tools`. Identity for find/replace/remove. */
export const TRANSFER_TOOL_NAME = 'transfer_to_owner'

/**
 * 30 seconds of ringing before the transfer gives up and the receptionist carries on with the
 * caller. Proven on a real call 2026-09-18: the warm handoff connected, and an unanswered transfer
 * fell back to the receptionist taking details rather than dumping the caller.
 */
export const TRANSFER_RING_DURATION_MS = 30000

export interface TransferTool {
  type: 'transfer_call'
  name: string
  description: string
  transfer_destination: { type: 'predefined'; number: string }
  transfer_option: {
    type: 'warm_transfer'
    transfer_ring_duration_ms: number
    private_handoff_option: { type: 'prompt'; prompt: string }
  }
}

/**
 * The transfer tool, pointed at one owner's phone.
 *
 * This is a tool on the LLM's `general_tools`, not an agent-level field — confirmed by reproducing
 * a real call where the agent had no way to actually transfer and just recited the owner's phone
 * number back as text instead. The `transfer_phone_number` field this used to set doesn't exist
 * anywhere in the real retell-sdk Agent type.
 */
export function buildTransferTool(ownerPhone: string): TransferTool {
  return {
    type: 'transfer_call',
    name: TRANSFER_TOOL_NAME,
    description: 'Transfer the caller to the business owner when they explicitly ask to speak with a real person, describe a genuine emergency, or have a situation too complex to handle over the phone. Let the caller know you\'re connecting them before transferring.',
    transfer_destination: { type: 'predefined', number: ownerPhone },
    // Warm transfer with a private handoff: the AI briefs the owner privately (e.g. "I have Chris
    // on the line with an active leak") before connecting the caller — the owner hears context,
    // the caller doesn't hear the AI talking about them.
    transfer_option: {
      type: 'warm_transfer',
      transfer_ring_duration_ms: TRANSFER_RING_DURATION_MS,
      private_handoff_option: {
        type: 'prompt',
        prompt: 'Give a brief, natural one-sentence heads-up to whoever answers, based on the conversation so far — caller\'s first name and the core issue. Example: "I have Chris on the line with an active roof leak." Keep it under 10 seconds, then hand off.',
      },
    },
  }
}

/**
 * Digits only, with a US country code dropped, so `+18175550100`, `817-555-0100` and
 * `+1 (817) 555-0100` are all the same number.
 *
 * Without the country-code step this returns false for a number that is genuinely the same, and
 * the caller then rewrites the tool on every single webhook delivery to "fix" a difference that
 * does not exist. US-only on purpose: every number in this product is a US line.
 */
function phoneDigits(v: string | null | undefined): string {
  const d = (v ?? '').replace(/\D/g, '')
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = phoneDigits(a)
  return left.length > 0 && left === phoneDigits(b)
}

/**
 * Enough of a number to actually ring someone.
 *
 * "Do not attach a tool that transfers to nothing" covers an unusable number as much as a missing
 * one: a destination of `555` produces an agent that promises a person and then fails mid-call,
 * which is worse than one that never offers.
 */
export function looksDialable(phone: string | null | undefined): boolean {
  return phoneDigits(phone).length >= 10
}

export type TransferToolAction = 'attach' | 'remove' | 'none' | 'blocked'

export interface TransferToolDecision {
  action: TransferToolAction
  /** Always populated. A caller alerts with this, so a refusal is never invisible. */
  reason: string
}

export interface TransferToolInput {
  /** The tier the client is paying for *now*. */
  tier: string | null | undefined
  /** Their forwarding number, or null when we have never been given one. */
  ownerPhone: string | null | undefined
  /** Whether the LLM already carries a tool named `transfer_to_owner`. */
  toolPresent: boolean
  /** Where the existing tool points, when there is one — so a changed number re-points it. */
  toolDestination?: string | null
}

/**
 * Should this client's agent carry the transfer tool, and does reality already match?
 *
 * Expressed as converge-to-desired-state rather than as "what did the tier change from", because
 * Stripe re-delivers and retries webhooks: the same event arriving twice must not attach a second
 * tool, and a failed attach must be repairable by simply running this again.
 */
export function decideTransferTool(input: TransferToolInput): TransferToolDecision {
  const isElite = input.tier === 'Elite'

  if (!isElite) {
    return input.toolPresent
      ? {
          action: 'remove',
          reason: `Tier is ${input.tier ?? 'unset'}, not Elite — removing the transfer tool. Leaving it would keep a promise the client no longer pays for, and keep routing callers to a number they may have stopped answering.`,
        }
      : { action: 'none', reason: `Tier is ${input.tier ?? 'unset'} and no transfer tool is attached — nothing to do.` }
  }

  if (!looksDialable(input.ownerPhone)) {
    // Never attach a transfer whose destination is empty: the caller hears the agent promise a
    // person, then silence. Elite with no number on file is a real state — before 2026-09-18 the
    // phone Stripe collects was discarded for every non-Elite signup, which is exactly who upgrades.
    return input.toolPresent
      ? {
          action: 'none',
          reason: 'Elite with no owner_phone on file, but a transfer tool is already attached from an earlier provisioning. Leaving it alone: it has a working destination, and removing it would take away a feature the client pays for.',
        }
      : {
          action: 'blocked',
          reason: input.ownerPhone
            ? `Elite, but the forwarding number on file (${input.ownerPhone}) is not a dialable number, so there is nothing to transfer to. The tier has been applied; Live Call Transfer is NOT active until agent_subscriptions.owner_phone holds a real number.`
            : 'Elite, but no forwarding number is on file for this client, so there is nothing to transfer to. The tier has been applied; Live Call Transfer is NOT active until a number is recorded on agent_subscriptions.owner_phone.',
        }
  }

  if (!input.toolPresent) {
    return { action: 'attach', reason: 'Elite with a forwarding number on file and no transfer tool attached — attaching it.' }
  }

  if (!samePhone(input.toolDestination, input.ownerPhone)) {
    return {
      action: 'attach',
      reason: `The attached transfer tool points at ${input.toolDestination ?? 'no number'}, but this client's forwarding number is ${input.ownerPhone} — re-pointing it.`,
    }
  }

  return { action: 'none', reason: 'Elite, and the transfer tool is already attached and pointed at the right number.' }
}

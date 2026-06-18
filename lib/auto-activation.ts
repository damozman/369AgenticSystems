import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  followupUpgrade: { leads: 30,    message: 'You\'ve captured 30+ leads — the Follow-up Agent pays for itself by converting them automatically.' },
  reviewsUpgrade:  { bookings: 10, message: 'You\'ve completed 10+ jobs — the Reviews Agent turns those into 5-star reviews automatically.' },
  outreachSuggest: { answerRate: 0.95, weeks: 2, message: 'Your answer rate is above 95% — you\'re ready to add an outbound Outreach Agent to proactively fill your pipeline.' },
}

// ── Check a single client against all thresholds ──────────────────────────────

export async function checkClientThresholds(clientDomain: string): Promise<{
  type:    string
  title:   string
  message: string
  action:  string
}[]> {
  const triggered: { type: string; title: string; message: string; action: string }[] = []

  // Get current subscription
  const { data: sub } = await supabase
    .from('agent_subscriptions')
    .select('tier, active_agents')
    .eq('client_domain', clientDomain)
    .maybeSingle()

  if (!sub) return []

  const currentAgents = sub.active_agents as string[]

  // Trigger 1: 30+ leads → suggest Follow-up upgrade (if not already on Pro/Elite)
  if (!currentAgents.includes('followup')) {
    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('client_domain', clientDomain)

    if ((leadCount ?? 0) >= THRESHOLDS.followupUpgrade.leads) {
      triggered.push({
        type:    'upgrade_suggestion',
        title:   'Upgrade to Pro: Follow-up Agent',
        message: THRESHOLDS.followupUpgrade.message,
        action:  'upgrade_to_pro',
      })
    }
  }

  // Trigger 2: 10+ completed bookings → suggest Reviews upgrade (if not already on Elite)
  if (!currentAgents.includes('reviews')) {
    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('client_domain', clientDomain)
      .eq('status', 'completed')

    if ((bookingCount ?? 0) >= THRESHOLDS.reviewsUpgrade.bookings) {
      triggered.push({
        type:    'upgrade_suggestion',
        title:   'Upgrade to Elite: Reviews Agent',
        message: THRESHOLDS.reviewsUpgrade.message,
        action:  'upgrade_to_elite',
      })
    }
  }

  return triggered
}

// ── Run checks across all active clients, create notifications ────────────────

export async function runAutoActivation(): Promise<{
  checked:  number
  created:  number
  skipped:  number
}> {
  const { data: subscriptions } = await supabase
    .from('agent_subscriptions')
    .select('client_domain, user_email, tier')

  if (!subscriptions?.length) return { checked: 0, created: 0, skipped: 0 }

  let created = 0
  let skipped = 0

  for (const sub of subscriptions) {
    const triggers = await checkClientThresholds(sub.client_domain)

    for (const trigger of triggers) {
      // Check if this notification already exists and hasn't been dismissed
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('client_domain', sub.client_domain)
        .eq('type', trigger.type)
        .eq('action', trigger.action)
        .eq('dismissed', false)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      // Create the notification
      const { error } = await supabase.from('notifications').insert({
        client_domain: sub.client_domain,
        type:          trigger.type,
        title:         trigger.title,
        message:       trigger.message,
        action:        trigger.action,
      })

      if (!error) created++
    }
  }

  return { checked: subscriptions.length, created, skipped }
}

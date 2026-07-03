import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Zap } from 'lucide-react'
import ClientDashboardView from '@/components/portal/ClientDashboardView'

const AGENT_LABELS: Record<string, { label: string; description: string; color: string }> = {
  receptionist: { label: '24/7 AI Receptionist', description: 'Answers calls, captures leads, and books appointments', color: '#D4AF37' },
  followup:     { label: 'Lead Follow-up Agent',  description: 'Nurtures captured leads until they convert',          color: '#A78BFA' },
  reviews:      { label: 'Review Request Agent',  description: 'Requests reviews and monitors your reputation',       color: '#4ADE80' },
  dashboard:    { label: 'Real-time Dashboard',   description: 'Live call activity, leads, and performance metrics',  color: '#60A5FA' },
}

const UPGRADE_PATHS: Record<string, { tier: string; agents: string[]; price: number } | null> = {
  Starter: { tier: 'Pro',   agents: ['followup'], price: 600 },
  Pro:     { tier: 'Elite', agents: ['reviews'],  price: 750 },
  Elite:   null,
}

export default async function ClientDashboardPage() {
  noStore()

  const supabase      = createClient()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { data: subscription } = await supabaseAdmin
    .from('agent_subscriptions')
    .select('*')
    .eq('user_email', user?.email ?? '')
    .maybeSingle()

  if (!subscription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div
          className="w-14 h-14 rounded-xl border flex items-center justify-center mb-5"
          style={{ borderColor: 'rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.05)' }}
        >
          <Zap size={20} style={{ color: '#D4AF37' }} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No active subscription</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6 leading-relaxed">
          Your account isn&apos;t linked to a deployment yet. Contact us to get your AI workforce configured.
        </p>
        <a
          href="mailto:chris@369agenticsystems.com?subject=Account Setup"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: '#D4AF37', color: '#000' }}
        >
          Contact Setup Team
        </a>
      </div>
    )
  }

  const clientDomain = subscription.client_domain

  const JOB_VALUE: Record<string, number> = {
    roofing:       2500,
    hvac:           350,
    plumbing:       400,
    legal:         5000,
    'real-estate': 9000,
    insurance:     1200,
    saas:          2400,
    wholesale:     2500,
    dental:         200,
  }

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalCalls },
    { count: bookedCalls },
    { count: totalLeads },
    { data: recentCallsData },
    { data: notifications },
    { data: lastCallRow },
    { data: calls30dData },
  ] = await Promise.all([
    supabaseAdmin.from('calls').select('*', { count: 'exact', head: true }).eq('client_domain', clientDomain),
    supabaseAdmin.from('calls').select('*', { count: 'exact', head: true }).eq('client_domain', clientDomain).eq('call_outcome', 'booked'),
    supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('client_domain', clientDomain),
    supabaseAdmin
      .from('calls')
      .select('id,created_at,caller_name,caller_phone,duration_seconds,transcript,call_outcome')
      .eq('client_domain', clientDomain)
      .order('created_at', { ascending: false })
      .limit(10),
    supabaseAdmin
      .from('notifications')
      .select('id,title,message')
      .eq('client_domain', clientDomain)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('calls')
      .select('created_at')
      .eq('client_domain', clientDomain)
      .order('created_at', { ascending: false })
      .limit(1),
    supabaseAdmin
      .from('calls')
      .select('created_at,call_outcome')
      .eq('client_domain', clientDomain)
      .gte('created_at', since30d),
  ])

  // Compute weekly deltas and highlights from the 30-day window
  const calls30d     = calls30dData ?? []
  const sevenDaysAgo = Date.now() - 7  * 24 * 60 * 60 * 1000
  const fourteenAgo  = Date.now() - 14 * 24 * 60 * 60 * 1000

  const thisWeek = calls30d.filter(c => new Date(c.created_at).getTime() >= sevenDaysAgo)
  const lastWeek = calls30d.filter(c => {
    const t = new Date(c.created_at).getTime()
    return t >= fourteenAgo && t < sevenDaysAgo
  })

  const afterHoursRescued = thisWeek.filter(c => {
    const h = new Date(c.created_at).getHours()
    return h < 8 || h >= 18
  }).length

  const jobValue          = JOB_VALUE[subscription.vertical as string ?? 'roofing'] ?? 1000
  const monthBooked       = calls30d.filter(c => c.call_outcome === 'booked').length
  const monthLeads        = calls30d.filter(c => c.call_outcome === 'captured_lead').length
  const revenueProtected  = Math.round((monthBooked + monthLeads) * jobValue * 0.30)

  const weeklyStats = {
    thisWeekCalls:    thisWeek.length,
    lastWeekCalls:    lastWeek.length,
    thisWeekBooked:   thisWeek.filter(c => c.call_outcome === 'booked').length,
    lastWeekBooked:   lastWeek.filter(c => c.call_outcome === 'booked').length,
    thisWeekLeads:    thisWeek.filter(c => c.call_outcome === 'captured_lead').length,
    lastWeekLeads:    lastWeek.filter(c => c.call_outcome === 'captured_lead').length,
    afterHoursRescued,
    revenueProtected,
  }

  const activeAgents = ((subscription.active_agents ?? []) as string[])
    .map(key => ({ key, ...AGENT_LABELS[key] }))
    .filter(a => a.label)

  const upgrade = UPGRADE_PATHS[subscription.tier as string] ?? null

  return (
    <ClientDashboardView
      stats={{
        totalCalls:  totalCalls  ?? 0,
        bookedCalls: bookedCalls ?? 0,
        totalLeads:  totalLeads  ?? 0,
      }}
      recentCalls={recentCallsData ?? []}
      activeAgents={activeAgents}
      upgrade={upgrade}
      subscription={{
        client_domain: subscription.client_domain,
        tier:          subscription.tier,
        vertical:      subscription.vertical,
      }}
      notifications={notifications ?? []}
      lastCallAt={(lastCallRow ?? [])[0]?.created_at ?? null}
      weeklyStats={weeklyStats}
    />
  )
}

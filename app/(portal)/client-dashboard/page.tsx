import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Phone, CalendarCheck, Users, Zap, ArrowRight, CheckCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { PREMIUM_ADDONS, type TierName } from '@/lib/tier-config'

// ── Tier definitions ──────────────────────────────────────────────────────────

const AGENT_LABELS: Record<string, { label: string; description: string; color: string }> = {
  receptionist: { label: '24/7 AI Receptionist', description: 'Answers calls, captures leads, books appointments',  color: '#D4AF37' },
  followup:     { label: 'Lead Follow-up Agent',  description: 'Nurtures captured leads until they convert',        color: '#A78BFA' },
  reviews:      { label: 'Review Request Agent',  description: 'Requests reviews and monitors reputation',          color: '#4ADE80' },
  dashboard:    { label: 'Real-time Dashboard',   description: 'Live call activity, leads, and performance metrics', color: '#60A5FA' },
}

const UPGRADE_PATHS: Record<string, { tier: string; agents: string[]; price: number } | null> = {
  Starter: { tier: 'Pro',   agents: ['followup'],          price: 600 },
  Pro:     { tier: 'Elite', agents: ['reviews'],            price: 750 },
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

  // Look up this user's subscription
  const { data: subscription } = await supabaseAdmin
    .from('agent_subscriptions')
    .select('*')
    .eq('user_email', user?.email ?? '')
    .maybeSingle()

  // Fetch metrics scoped to their domain (if subscription exists)
  const clientDomain = subscription?.client_domain ?? null

  const [
    { count: totalCalls },
    { count: bookedCalls },
    { count: totalLeads },
    { data: notifications },
  ] = await Promise.all([
    clientDomain
      ? supabaseAdmin.from('calls').select('*', { count: 'exact', head: true }).eq('client_domain', clientDomain)
      : Promise.resolve({ count: 0 }),
    clientDomain
      ? supabaseAdmin.from('calls').select('*', { count: 'exact', head: true }).eq('client_domain', clientDomain).eq('call_outcome', 'booked')
      : Promise.resolve({ count: 0 }),
    clientDomain
      ? supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('client_domain', clientDomain)
      : Promise.resolve({ count: 0 }),
    clientDomain
      ? supabaseAdmin.from('notifications').select('*').eq('client_domain', clientDomain).eq('dismissed', false).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const activeAgents  = (subscription?.active_agents ?? []) as string[]
  const upgrade       = subscription ? UPGRADE_PATHS[subscription.tier] : null

  // ── No subscription state ─────────────────────────────────────────────────

  if (!subscription) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">
        <div className="mb-8">
          <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-1">
            // CLIENT PORTAL
          </p>
          <h1 className="text-3xl font-display font-bold text-white">Your Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">{user?.email}</p>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-xl bg-[rgba(212,175,55,0.08)] border border-[var(--border-gold)] flex items-center justify-center mb-6">
            <Zap size={20} className="text-[#D4AF37]" />
          </div>
          <h2 className="text-xl font-display font-semibold text-white mb-3">No active subscription</h2>
          <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
            Your account isn't linked to a deployment yet. Contact us to get your AI workforce configured.
          </p>
          <a
            href="mailto:chris@369agenticsystems.com?subject=Account Setup"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4AF37] text-black rounded-lg text-sm font-semibold hover:bg-[#E8C94A] transition-colors"
          >
            Contact Setup Team
          </a>
        </div>
      </div>
    )
  }

  // ── Active subscription view ──────────────────────────────────────────────

  const STATS = [
    { label: 'Total Calls',    value: String(totalCalls ?? 0),  color: '#D4AF37', Icon: Phone         },
    { label: 'Appointments',   value: String(bookedCalls ?? 0), color: '#4ADE80', Icon: CalendarCheck  },
    { label: 'Leads Captured', value: String(totalLeads ?? 0),  color: '#60A5FA', Icon: Users          },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-1">
            // CLIENT PORTAL
          </p>
          <h1 className="text-3xl font-display font-bold text-white">Your Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            {subscription.client_domain}
            <span className="mx-2 text-slate-700">·</span>
            <span className="text-[#D4AF37] font-mono text-xs">{subscription.tier} Plan</span>
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-2 justify-end">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">Active</span>
          </div>
          <p className="text-[10px] font-mono text-slate-500 mt-1 capitalize">{subscription.vertical} · {subscription.tier}</p>
        </div>
      </div>

      {/* Upgrade notifications */}
      {(notifications ?? []).length > 0 && (
        <div className="mb-6 space-y-2">
          {(notifications ?? []).map((n: { id: string; title: string; message: string }) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.06)]">
              <Zap size={14} className="text-[#D4AF37] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#D4AF37]">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        {STATS.map(({ label, value, color, Icon }) => (
          <div
            key={label}
            className="bg-[var(--bg-surface)] rounded-xl border p-4"
            style={{ borderColor: `${color}22` }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider leading-tight">{label}</p>
              <Icon size={15} style={{ color }} className="flex-shrink-0 mt-0.5" />
            </div>
            <p className="text-3xl font-display font-bold text-white">{value}</p>
            <p className="text-[10px] font-mono mt-1" style={{ color }}>all time</p>
          </div>
        ))}
      </div>

      {/* Active Agents */}
      <div className="mb-8">
        <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-3">
          // ACTIVE AGENTS — {subscription.tier.toUpperCase()} PLAN
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeAgents.map(agentKey => {
            const agent = AGENT_LABELS[agentKey]
            if (!agent) return null
            return (
              <div
                key={agentKey}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
              >
                <CheckCircle size={14} style={{ color: agent.color }} className="flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 leading-none">{agent.label}</p>
                  <p className="text-[10px] font-mono text-slate-600 mt-0.5">{agent.description}</p>
                </div>
                <span className="ml-auto text-[9px] font-mono text-emerald-500 uppercase tracking-wider flex-shrink-0">
                  LIVE
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Enhancements (premium add-ons available for this tier) */}
      {(() => {
        const currentTier = subscription.tier as TierName
        const available = PREMIUM_ADDONS.filter(a => a.availableFor.includes(currentTier))
        if (available.length === 0) return null
        return (
          <div className="mb-8">
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Sparkles size={10} className="text-[#D4AF37]" />
              // AVAILABLE ENHANCEMENTS
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {available.map(addon => (
                <div
                  key={addon.id}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-slate-200 leading-none">{addon.label}</p>
                      <span className="text-[10px] font-mono text-[#D4AF37] flex-shrink-0">+${addon.price}/mo</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-600 leading-relaxed">{addon.description}</p>
                  </div>
                  <a
                    href={`mailto:chris@369agenticsystems.com?subject=Add-on Request: ${addon.label} — ${subscription.client_domain}`}
                    className="flex-shrink-0 text-[10px] font-mono text-[#D4AF37] hover:text-[#E8C94A] transition-colors mt-0.5 whitespace-nowrap"
                  >
                    Request →
                  </a>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Upgrade card */}
      {upgrade && (
        <div className="rounded-xl border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.04)] p-6">
          <p className="text-[9px] font-mono text-[#D4AF37] uppercase tracking-widest mb-2">
            // AVAILABLE UPGRADE
          </p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-display font-semibold text-white mb-1">
                Upgrade to {upgrade.tier} — ${upgrade.price}/mo
              </h3>
              <p className="text-sm text-slate-400">
                Unlock: {upgrade.agents.map(a => AGENT_LABELS[a]?.label ?? a).join(', ')}
              </p>
            </div>
            <a
              href={`mailto:chris@369agenticsystems.com?subject=Upgrade to ${upgrade.tier} — ${subscription.client_domain}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] text-black rounded-lg text-sm font-semibold hover:bg-[#E8C94A] transition-colors flex-shrink-0"
            >
              Upgrade Now <ArrowRight size={13} />
            </a>
          </div>
        </div>
      )}

    </div>
  )
}

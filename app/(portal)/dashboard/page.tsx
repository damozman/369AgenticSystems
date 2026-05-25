import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ActiveSpecialists from '@/components/portal/ActiveSpecialists'
import LiveFeed from '@/components/portal/LiveFeed'
import BusinessMemory from '@/components/portal/BusinessMemory'
import LeadsTable from '@/components/portal/LeadsTable'
import PendingResponses from '@/components/portal/PendingResponses'
import { Activity, Users, Zap, MessageSquare } from 'lucide-react'

export default async function DashboardPage() {
  noStore()

  const supabase = createClient()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { data: { user } },
    { data: initialAudits },
    { count: totalAudits },
    { count: activeAudits },
    { count: leaksDetected },
    { count: pendingResponses },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabaseAdmin.from('system_audits').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('system_audits').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('system_audits').select('*', { count: 'exact', head: true }).eq('payload_status', 'active'),
    supabaseAdmin.from('system_audits').select('*', { count: 'exact', head: true }).eq('leak_detected', true),
    supabaseAdmin.from('pending_responses').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const STAT_CARDS = [
    { label: 'Audits Run',         value: String(totalAudits ?? 0),       delta: 'all time',             color: '#D4AF37', Icon: Users          },
    { label: 'Active Deployments', value: String(activeAudits ?? 0),      delta: 'currently live',       color: '#4ADE80', Icon: Activity       },
    { label: 'Pending Responses',  value: String(pendingResponses ?? 0),  delta: 'awaiting approval',    color: '#A78BFA', Icon: MessageSquare  },
    { label: 'Leaks Detected',     value: String(leaksDetected ?? 0),     delta: 'flagged for review',   color: '#F87171', Icon: Zap            },
  ]

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-1">
            // COMMAND CENTER
          </p>
          <h1 className="text-3xl font-display font-bold text-white">Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            {user?.email}
            <span className="mx-2 text-slate-700">·</span>
            Your Digital Workforce is active
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-2 justify-end mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
              All Systems Go
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-400">{dateLabel}</p>
        </div>
      </div>

      {/* ── Stat bar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {STAT_CARDS.map(({ label, value, delta, color, Icon }) => (
          <div
            key={label}
            className="bg-[var(--bg-surface)] rounded-xl border p-4"
            style={{ borderColor: `${color}22` }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider leading-tight">
                {label}
              </p>
              <Icon size={15} style={{ color }} className="flex-shrink-0 mt-0.5" />
            </div>
            <p className="text-3xl font-display font-bold text-white">{value}</p>
            <p className="text-xs font-mono mt-1" style={{ color }}>{delta}</p>
          </div>
        ))}
      </div>

      {/* ── Audit Grid + Live Feed ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-6 mb-6">
        <ActiveSpecialists initialAudits={initialAudits ?? []} />
        <LiveFeed />
      </div>

      {/* ── Business Memory ─────────────────────────────────────── */}
      <BusinessMemory />

      {/* ── Leads Table ──────────────────────────────────────────── */}
      <div className="mt-6">
        <LeadsTable initialAudits={initialAudits ?? []} />
      </div>

      {/* ── Pending Responses ────────────────────────────────────── */}
      <PendingResponses />

    </div>
  )
}

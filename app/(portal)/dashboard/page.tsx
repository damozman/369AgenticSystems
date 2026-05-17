import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ActiveSpecialists from '@/components/portal/ActiveSpecialists'
import LiveFeed from '@/components/portal/LiveFeed'
import BusinessMemory from '@/components/portal/BusinessMemory'
import { Activity, Users, FileText, Zap } from 'lucide-react'

const STAT_CARDS = [
  { label: 'Active Specialists', value: '4',   delta: '+2 this month',    color: '#D4AF37', Icon: Users     },
  { label: 'Tasks Completed',    value: '127',  delta: 'last 7 days',      color: '#4ADE80', Icon: Activity  },
  { label: 'Dossiers Generated', value: '43',   delta: 'all time',         color: '#60A5FA', Icon: FileText  },
  { label: 'Revenue Recovered',  value: '$84K', delta: 'estimated / qtr',  color: '#A78BFA', Icon: Zap       },
]

export default async function DashboardPage() {
  // Opt every fetch in this render out of Next.js's Data Cache.
  // Without this, the admin client's fixed service-role header produces an
  // identical cache key on every request and serves the first (empty) response.
  noStore()

  const supabase = createClient()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: { user } }, { data: initialAudits }] = await Promise.all([
    supabase.auth.getUser(),
    supabaseAdmin
      .from('system_audits')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

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
          <h1 className="text-2xl font-display font-bold text-white">Overview</h1>
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
          <p className="text-[10px] font-mono text-slate-600">{dateLabel}</p>
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
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider leading-tight">
                {label}
              </p>
              <Icon size={14} style={{ color }} className="flex-shrink-0 mt-0.5" />
            </div>
            <p className="text-2xl font-display font-bold text-white">{value}</p>
            <p className="text-[10px] font-mono mt-1" style={{ color }}>{delta}</p>
          </div>
        ))}
      </div>

      {/* ── Audit Grid + Live Feed ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 mb-6">
        <ActiveSpecialists initialAudits={initialAudits ?? []} />
        <LiveFeed />
      </div>

      {/* ── Business Memory ─────────────────────────────────────── */}
      <BusinessMemory />

    </div>
  )
}

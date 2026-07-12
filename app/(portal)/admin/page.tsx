import { unstable_noStore as noStore } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { TrendingUp, Users, DollarSign, AlertTriangle } from 'lucide-react'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

interface ClientMetrics {
  clientDomain: string
  vertical: string
  tier: string
  totalCalls: number
  bookedCalls: number
  totalLeads: number
  revenueProtected: number
  monthlyFee: number
  activatedAt: string
}

export default async function AdminDashboard() {
  noStore()

  // Fetch all subscriptions
  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from('agent_subscriptions')
    .select('client_domain, vertical, tier, monthly_cost, activated_at')

  if (subError || !subscriptions) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Failed to load admin dashboard</p>
      </div>
    )
  }

  // Calculate metrics for each client
  const clientMetrics: ClientMetrics[] = []
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  for (const sub of subscriptions) {
    const { count: totalCalls } = await supabaseAdmin
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('client_domain', sub.client_domain)

    const { count: bookedCalls } = await supabaseAdmin
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('client_domain', sub.client_domain)
      .eq('call_outcome', 'booked')

    const { count: totalLeads } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('client_domain', sub.client_domain)

    const { data: calls30d } = await supabaseAdmin
      .from('calls')
      .select('call_outcome')
      .eq('client_domain', sub.client_domain)
      .gte('created_at', since30d)

    const monthBooked = (calls30d || []).filter(c => c.call_outcome === 'booked').length
    const monthLeads = (calls30d || []).filter(c => c.call_outcome === 'captured_lead').length
    const jobValue = JOB_VALUE[sub.vertical as string] ?? 1000
    const revenueProtected = Math.round((monthBooked + monthLeads) * jobValue * 0.30)

    clientMetrics.push({
      clientDomain: sub.client_domain,
      vertical: sub.vertical,
      tier: sub.tier,
      totalCalls: totalCalls ?? 0,
      bookedCalls: bookedCalls ?? 0,
      totalLeads: totalLeads ?? 0,
      revenueProtected,
      monthlyFee: sub.monthly_cost,
      activatedAt: sub.activated_at,
    })
  }

  // Calculate aggregate metrics
  const totalClients = clientMetrics.length
  const totalCalls = clientMetrics.reduce((sum, m) => sum + m.totalCalls, 0)
  const totalRevenueProtected = clientMetrics.reduce((sum, m) => sum + m.revenueProtected, 0)
  const totalMRR = clientMetrics.reduce((sum, m) => sum + m.monthlyFee, 0)
  const avgRevenuePerClient = totalClients > 0 ? Math.round(totalRevenueProtected / totalClients) : 0

  // Group by tier
  const byTier = {
    starter: clientMetrics.filter(m => m.tier === 'Starter'),
    pro: clientMetrics.filter(m => m.tier === 'Pro'),
    elite: clientMetrics.filter(m => m.tier === 'Elite'),
  }

  // Group by vertical
  const byVertical = Array.from(new Set(clientMetrics.map(m => m.vertical)))
    .map(v => ({
      vertical: v,
      clients: clientMetrics.filter(m => m.vertical === v),
    }))
    .sort((a, b) => b.clients.length - a.clients.length)

  // Revenue by vertical
  const revenueByVertical = byVertical
    .map(v => ({
      vertical: v.vertical,
      revenue: v.clients.reduce((sum, m) => sum + m.revenueProtected, 0),
      mrr: v.clients.reduce((sum, m) => sum + m.monthlyFee, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // Sort clients by revenue (top performers)
  const topPerformers = [...clientMetrics]
    .sort((a, b) => b.revenueProtected - a.revenueProtected)
    .slice(0, 10)

  // Churn risk: clients with 0 calls in last 30 days (quiet)
  const churnRisk = clientMetrics.filter(m => {
    const daysSinceActivation = (Date.now() - new Date(m.activatedAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceActivation > 7 && m.totalCalls === 0  // quiet for 30+ days
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Admin Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">Business overview across all {totalClients} clients</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Clients</p>
            <Users size={16} className="text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalClients}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Calls</p>
            <TrendingUp size={16} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalCalls.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Revenue Protected</p>
            <DollarSign size={16} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">${(totalRevenueProtected / 1000).toFixed(1)}K</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">30-day proactive</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Monthly Recurring</p>
            <DollarSign size={16} className="text-amber-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">${totalMRR.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">all tiers</p>
        </div>
      </div>

      {/* By Tier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Starter ($400)', data: byTier.starter, color: '#94A3B8' },
          { label: 'Pro ($600)', data: byTier.pro, color: '#D4AF37' },
          { label: 'Elite ($750)', data: byTier.elite, color: '#60A5FA' },
        ].map(tier => (
          <div key={tier.label} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{tier.label}</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Clients</span>
                <span className="font-semibold text-slate-900 dark:text-white">{tier.data.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Total calls</span>
                <span className="font-semibold text-slate-900 dark:text-white">{tier.data.reduce((s, m) => s + m.totalCalls, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Revenue protected</span>
                <span className="font-semibold text-slate-900 dark:text-white">${(tier.data.reduce((s, m) => s + m.revenueProtected, 0) / 1000).toFixed(1)}K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">MRR</span>
                <span className="font-semibold text-slate-900 dark:text-white">${(tier.data.reduce((s, m) => s + m.monthlyFee, 0)).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue by Vertical */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Revenue by Vertical</h2>
        <div className="space-y-3">
          {revenueByVertical.map(rv => (
            <div key={rv.vertical} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-white capitalize">{rv.vertical}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {byVertical.find(v => v.vertical === rv.vertical)?.clients.length || 0} clients
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900 dark:text-white">${(rv.revenue / 1000).toFixed(1)}K protected</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">${rv.mrr.toLocaleString()}/mo</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">🏆 Top Performers (30-day)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 font-medium text-slate-700 dark:text-slate-300">Client</th>
                  <th className="text-left py-2 font-medium text-slate-700 dark:text-slate-300">Vertical</th>
                  <th className="text-right py-2 font-medium text-slate-700 dark:text-slate-300">Calls</th>
                  <th className="text-right py-2 font-medium text-slate-700 dark:text-slate-300">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((p, i) => (
                  <tr key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="py-2 text-slate-900 dark:text-white">{p.clientDomain}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-400 capitalize">{p.vertical}</td>
                    <td className="text-right py-2 text-slate-900 dark:text-white font-medium">{p.totalCalls}</td>
                    <td className="text-right py-2 text-slate-900 dark:text-white font-semibold">${(p.revenueProtected / 1000).toFixed(1)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Churn Risk */}
      {churnRisk.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} className="text-red-600" />
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-100">⚠️ Churn Risk ({churnRisk.length})</h2>
          </div>
          <p className="text-sm text-red-800 dark:text-red-200 mb-4">
            Clients activated 7+ days ago with no calls in the last 30 days
          </p>
          <div className="space-y-2">
            {churnRisk.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{c.clientDomain}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{c.tier} • {c.vertical}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">${c.monthlyFee}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

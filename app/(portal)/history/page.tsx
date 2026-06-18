import { unstable_noStore as noStore } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import LeadsTable from '@/components/portal/LeadsTable'

export default async function HistoryPage() {
  noStore()

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: initialAudits } = await supabaseAdmin
    .from('system_audits')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">

      <div className="mb-6 sm:mb-8">
        <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-1">
          // DEPLOYMENT HISTORY
        </p>
        <h1 className="text-3xl font-display font-bold text-white">Dossier Logs</h1>
        <p className="text-sm text-slate-400 mt-1">Full audit record across all clients and deployments</p>
      </div>

      <LeadsTable initialAudits={initialAudits ?? []} />

    </div>
  )
}

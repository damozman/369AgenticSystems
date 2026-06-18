import { unstable_noStore as noStore } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ActiveSpecialists from '@/components/portal/ActiveSpecialists'
import PendingResponses from '@/components/portal/PendingResponses'
import PendingAlert from '@/components/portal/PendingAlert'

export default async function WorkforcePage() {
  noStore()

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { data: initialAudits },
    { count: pendingResponses },
  ] = await Promise.all([
    supabaseAdmin.from('system_audits').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('pending_responses').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">

      <div className="mb-6 sm:mb-8">
        <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-1">
          // WORKFORCE
        </p>
        <h1 className="text-3xl font-display font-bold text-white">Active Digital Employees</h1>
        <p className="text-sm text-slate-400 mt-1">AI agents deployed across your client roster</p>
      </div>

      <PendingAlert initialCount={pendingResponses ?? 0} />

      <ActiveSpecialists initialAudits={initialAudits ?? []} />

      <div id="pending-responses" className="mt-8">
        <PendingResponses />
      </div>

    </div>
  )
}

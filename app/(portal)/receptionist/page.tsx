import { unstable_noStore as noStore } from 'next/cache'
import CallsStatsBar from '@/components/portal/CallsStatsBar'
import CallLeadsTable from '@/components/portal/CallLeadsTable'

export default async function ReceptionistPage() {
  noStore()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">

      <div className="mb-6 sm:mb-8">
        <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-1">
          // RECEPTIONIST
        </p>
        <h1 className="text-3xl font-display font-bold text-white">Call Activity</h1>
        <p className="text-sm text-slate-400 mt-1">Inbound calls, captured leads, and booked appointments — real-time</p>
      </div>

      <CallsStatsBar />

      <div className="mt-8">
        <CallLeadsTable />
      </div>

    </div>
  )
}

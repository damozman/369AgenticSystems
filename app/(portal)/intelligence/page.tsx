import { unstable_noStore as noStore } from 'next/cache'
import BusinessMemory from '@/components/portal/BusinessMemory'

export default async function IntelligencePage() {
  noStore()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">

      <div className="mb-6 sm:mb-8">
        <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-1">
          // INTELLIGENCE VAULT
        </p>
        <h1 className="text-3xl font-display font-bold text-white">Business Memory</h1>
        <p className="text-sm text-slate-400 mt-1">Accumulated insights across all client interactions</p>
      </div>

      <BusinessMemory />

    </div>
  )
}

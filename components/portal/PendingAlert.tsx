'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { BellRing } from 'lucide-react'

export default function PendingAlert({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const supabase = createClient()

    const refetch = () =>
      supabase
        .from('pending_responses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(({ count: c }) => { if (c !== null) setCount(c) })

    const channel = supabase
      .channel('pending_alert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pending_responses' }, refetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pending_responses' }, refetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (count === 0) return null

  return (
    <div className="mb-6 rounded-xl border-2 border-[#D4AF37] bg-[rgba(212,175,55,0.08)] px-5 py-4 flex items-center justify-between gap-4 shadow-[0_0_24px_rgba(212,175,55,0.12)]">
      <div className="flex items-center gap-3">
        <BellRing size={18} className="text-[#D4AF37] flex-shrink-0 animate-pulse" />
        <div>
          <p className="text-sm font-bold text-[#D4AF37] tracking-wide">
            {count} response{count !== 1 ? 's' : ''} awaiting your approval
          </p>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            AI-drafted — review and authorize before sending
          </p>
        </div>
      </div>
      <button
        onClick={() => document.getElementById('pending-responses')?.scrollIntoView({ behavior: 'smooth' })}
        className="text-xs font-mono font-bold text-[#0D0D0D] bg-[#D4AF37] px-4 py-2 rounded-lg hover:bg-[#F0C94A] transition-colors flex-shrink-0 whitespace-nowrap"
      >
        REVIEW NOW ↓
      </button>
    </div>
  )
}

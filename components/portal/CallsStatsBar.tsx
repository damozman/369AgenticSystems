'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { Phone, CalendarCheck, Users } from 'lucide-react'

interface Call {
  id: string
  call_outcome: string | null
}

export default function CallsStatsBar() {
  const [calls, setCalls] = useState<Call[]>([])

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchCalls() {
      const { data } = await supabase
        .from('calls')
        .select('id, call_outcome')
        .order('created_at', { ascending: false })
        .limit(500)
      if (mounted && data) setCalls(data)
    }

    fetchCalls()

    const channel = supabase
      .channel('calls_stats')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls' },
        (payload) => {
          if (!mounted) return
          setCalls(prev => [payload.new as Call, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls' },
        (payload) => {
          if (!mounted) return
          const updated = payload.new as Call
          setCalls(prev => prev.map(c => c.id === updated.id ? updated : c))
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const total  = calls.length
  const booked = calls.filter(c => c.call_outcome === 'booked').length
  const leads  = calls.filter(c => c.call_outcome === 'captured_lead').length

  const STATS = [
    { label: 'Total Calls',      value: total,  color: '#D4AF37', Icon: Phone         },
    { label: 'Appointments',     value: booked, color: '#4ADE80', Icon: CalendarCheck  },
    { label: 'Leads Captured',   value: leads,  color: '#60A5FA', Icon: Users          },
  ]

  return (
    <div>
      <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-0.5">
        // RECEPTIONIST METRICS
      </p>
      <h2 className="text-lg font-display font-semibold text-white mb-4">Call Activity</h2>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {STATS.map(({ label, value, color, Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
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
            <div className="flex items-center gap-1 mt-1">
              <motion.div
                className="w-1 h-1 rounded-full"
                style={{ background: color }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <p className="text-[10px] font-mono" style={{ color }}>live</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, AlertTriangle, TrendingUp, Users, Lightbulb } from 'lucide-react'
import ScanCard from './ScanCard'

interface MemoryItem  { id: string; content: string; date: string }
interface MemoryGroup {
  id:    string
  label: string
  color: string
  Icon:  typeof AlertTriangle
  items: MemoryItem[]
}

const MEMORY: MemoryGroup[] = [
  {
    id: 'pain', label: 'Pain Points', color: '#F59E0B', Icon: AlertTriangle,
    items: [
      { id: 'p1', content: 'Primary blocker: speed-to-lead response time exceeds 4 hours', date: '2026-05-10' },
      { id: 'p2', content: 'Staff manually entering leads into CRM — 2hr/day admin overhead', date: '2026-05-08' },
      { id: 'p3', content: 'No automated follow-up after initial estimate is sent', date: '2026-05-02' },
    ],
  },
  {
    id: 'roi', label: 'ROI Data', color: '#4ADE80', Icon: TrendingUp,
    items: [
      { id: 'r1', content: 'Estimated $18,400/mo revenue recovery with lead response automation', date: '2026-05-10' },
      { id: 'r2', content: 'Current close rate: 22% vs. industry avg of 31% — 9pt gap', date: '2026-05-08' },
    ],
  },
  {
    id: 'leads', label: 'Lead Patterns', color: '#60A5FA', Icon: Users,
    items: [
      { id: 'l1', content: 'Peak lead volume: Mon–Wed 7–11am (storm season spikes)', date: '2026-05-09' },
      { id: 'l2', content: 'Highest conversion on leads contacted within 5 minutes', date: '2026-05-07' },
    ],
  },
  {
    id: 'insights', label: 'Agent Insights', color: '#A78BFA', Icon: Lightbulb,
    items: [
      { id: 'i1', content: 'Client uses high-urgency language in intake — flag for premium tier upsell', date: '2026-05-10' },
    ],
  },
]

function Group({ g }: { g: MemoryGroup }) {
  const [open, setOpen] = useState(g.id === 'pain')
  const Icon = g.Icon

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-[var(--item-bg)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={13} style={{ color: g.color }} />
          <span className="text-sm font-medium text-slate-200">{g.label}</span>
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded-full tracking-wider"
            style={{ color: g.color, background: `${g.color}18` }}
          >
            {g.items.length}
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} className="text-slate-600" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 px-4 pb-3">
              {g.items.map(item => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 pl-3 py-2 rounded-lg bg-[var(--item-bg)] border-l-2"
                  style={{ borderLeftColor: `${g.color}44` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
                    <p className="text-[9px] font-mono text-slate-700 mt-1">{item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function BusinessMemory() {
  const total = MEMORY.reduce((n, g) => n + g.items.length, 0)

  return (
    <ScanCard accentColor="#A78BFA" scanDelay={2}>
      <div className="p-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-0.5">
              // INTELLIGENCE VAULT
            </p>
            <h2 className="text-lg font-display font-semibold text-white">Business Memory</h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-slate-500">{total} entries</p>
            <p className="text-[10px] font-mono text-emerald-500">Active context</p>
          </div>
        </div>

        {/* Memory groups */}
        <div className="divide-y divide-[var(--border-faint)]">
          {MEMORY.map(g => <Group key={g.id} g={g} />)}
        </div>

        {/* Footer note */}
        <div className="mt-4 pt-4 border-t border-[var(--border-faint)]">
          <p className="text-[9px] font-mono text-slate-700 text-center">
            <span className="text-[#D4AF37]">›</span>{' '}
            Memory is loaded into every agent run automatically
          </p>
        </div>

      </div>
    </ScanCard>
  )
}

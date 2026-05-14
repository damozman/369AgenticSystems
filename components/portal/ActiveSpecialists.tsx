'use client'

import { motion } from 'framer-motion'
import ScanCard from './ScanCard'

type Status = 'active' | 'processing' | 'idle'

interface Specialist {
  id: string
  name: string
  role: string
  industry: string
  status: Status
  lastActivity: string
  tasksToday: number
  accentColor: string
}

const SPECIALISTS: Specialist[] = [
  {
    id: '1',
    name: 'Lead Response',
    role: 'Specialist',
    industry: 'Roofing',
    status: 'active',
    lastActivity: '2m ago',
    tasksToday: 14,
    accentColor: '#F59E0B',
  },
  {
    id: '2',
    name: 'Claims Triage',
    role: 'Specialist',
    industry: 'Insurance',
    status: 'processing',
    lastActivity: 'now',
    tasksToday: 7,
    accentColor: '#14B8A6',
  },
  {
    id: '3',
    name: 'Document Drafter',
    role: 'Specialist',
    industry: 'Legal',
    status: 'active',
    lastActivity: '8m ago',
    tasksToday: 3,
    accentColor: '#60A5FA',
  },
  {
    id: '4',
    name: 'Appointment Guardian',
    role: 'Specialist',
    industry: 'Dental',
    status: 'idle',
    lastActivity: '1h ago',
    tasksToday: 2,
    accentColor: '#EC4899',
  },
]

const STATUS_DOT: Record<Status, string> = {
  active:     '#4ADE80',
  processing: '#F59E0B',
  idle:       '#475569',
}

const STATUS_LABEL: Record<Status, string> = {
  active:     'ACTIVE',
  processing: 'PROCESSING',
  idle:       'IDLE',
}

function Card({ s, delay }: { s: Specialist; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <ScanCard accentColor={s.accentColor} scanDelay={delay * 1.2} className="h-full">
        <div className="p-5">

          {/* Industry + name */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p
                className="text-[10px] font-mono uppercase tracking-widest mb-1"
                style={{ color: s.accentColor }}
              >
                {s.industry}
              </p>
              <h3 className="text-white font-semibold text-sm leading-tight">{s.name}</h3>
              <p className="text-[10px] font-mono text-slate-600 mt-0.5">{s.role}</p>
            </div>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: `${s.accentColor}14`,
                border: `1px solid ${s.accentColor}28`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: s.accentColor }}
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 mb-4">
            {s.status === 'active' ? (
              <motion.div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: STATUS_DOT[s.status] }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            ) : (
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: STATUS_DOT[s.status] }}
              />
            )}
            <span
              className="text-[9px] font-mono tracking-widest"
              style={{ color: STATUS_DOT[s.status] }}
            >
              {STATUS_LABEL[s.status]}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2.5">
              <p className="text-[9px] font-mono text-slate-700 uppercase tracking-wider">Tasks Today</p>
              <p className="text-xl font-bold text-white mt-0.5">{s.tasksToday}</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2.5">
              <p className="text-[9px] font-mono text-slate-700 uppercase tracking-wider">Last Active</p>
              <p className="text-sm font-mono text-slate-300 mt-0.5">{s.lastActivity}</p>
            </div>
          </div>

        </div>
      </ScanCard>
    </motion.div>
  )
}

export default function ActiveSpecialists() {
  const online = SPECIALISTS.filter(s => s.status === 'active').length

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-0.5">
            // WORKFORCE
          </p>
          <h2 className="text-lg font-display font-semibold text-white">Active Specialists</h2>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs font-mono text-slate-500">{online} online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SPECIALISTS.map((s, i) => (
          <Card key={s.id} s={s} delay={i * 0.08} />
        ))}
      </div>
    </section>
  )
}

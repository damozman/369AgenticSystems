import Link from 'next/link'
import { Users, Brain, Clock, Phone, ChevronRight } from 'lucide-react'

interface Props {
  totalAudits:     number
  activeAudits:    number
  leaksDetected:   number
  totalCalls:      number
  bookedCalls:     number
}

interface Card {
  href:    string
  label:   string
  sub:     string
  stat:    string
  color:   string
  Icon:    React.ElementType
}

export default function SectionCards({
  totalAudits,
  activeAudits,
  leaksDetected,
  totalCalls,
  bookedCalls,
}: Props) {
  const cards: Card[] = [
    {
      href:  '/workforce',
      label: 'Workforce',
      sub:   'Active Digital Employees',
      stat:  `${activeAudits} active · ${totalAudits} total`,
      color: '#D4AF37',
      Icon:  Users,
    },
    {
      href:  '/intelligence',
      label: 'Intelligence Vault',
      sub:   'Business Memory',
      stat:  'Accumulated client insights',
      color: '#A78BFA',
      Icon:  Brain,
    },
    {
      href:  '/history',
      label: 'Deployment History',
      sub:   'Dossier Logs',
      stat:  `${totalAudits} audits · ${leaksDetected} warn${leaksDetected !== 1 ? 's' : ''}`,
      color: '#60A5FA',
      Icon:  Clock,
    },
    {
      href:  '/receptionist',
      label: 'Receptionist',
      sub:   'Call Activity',
      stat:  `${totalCalls} calls · ${bookedCalls} booked`,
      color: '#4ADE80',
      Icon:  Phone,
    },
  ]

  return (
    <div>
      <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-3">
        // QUICK ACCESS
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map(({ href, label, sub, stat, color, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-gold-mid)] hover:bg-[var(--metric-bg)] transition-all duration-150"
          >
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${color}18` }}
            >
              <Icon size={15} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors leading-none">
                {label}
              </p>
              <p className="text-[10px] font-mono text-slate-600 mt-0.5">{sub}</p>
              <p className="text-[10px] font-mono mt-1.5" style={{ color }}>{stat}</p>
            </div>
            <ChevronRight
              size={12}
              className="flex-shrink-0 text-slate-700 group-hover:text-slate-400 transition-colors"
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

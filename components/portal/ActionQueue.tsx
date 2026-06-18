import Link from 'next/link'
import { CheckCircle, Mail, AlertTriangle, Phone } from 'lucide-react'

interface Props {
  pendingCount:  number
  warnDomains:   string[]
  urgentLeads:   number
}

interface ActionItem {
  href:    string
  icon:    React.ReactNode
  label:   string
  detail:  string
  color:   string
  bg:      string
  border:  string
}

export default function ActionQueue({ pendingCount, warnDomains, urgentLeads }: Props) {
  const items: ActionItem[] = []

  if (pendingCount > 0) {
    items.push({
      href:   '/workforce#pending-responses',
      icon:   <Mail size={14} />,
      label:  `${pendingCount} pending email ${pendingCount === 1 ? 'response' : 'responses'}`,
      detail: 'AI-drafted — awaiting your approval',
      color:  '#A78BFA',
      bg:     'rgba(167,139,250,0.08)',
      border: 'rgba(167,139,250,0.25)',
    })
  }

  if (warnDomains.length > 0) {
    items.push({
      href:   '/history',
      icon:   <AlertTriangle size={14} />,
      label:  `${warnDomains.length} leak ${warnDomains.length === 1 ? 'detected' : 'detections'}`,
      detail: warnDomains.slice(0, 3).join(', ') + (warnDomains.length > 3 ? ` +${warnDomains.length - 3} more` : ''),
      color:  '#F87171',
      bg:     'rgba(248,113,113,0.08)',
      border: 'rgba(248,113,113,0.25)',
    })
  }

  if (urgentLeads > 0) {
    items.push({
      href:   '/receptionist',
      icon:   <Phone size={14} />,
      label:  `${urgentLeads} urgent inbound ${urgentLeads === 1 ? 'lead' : 'leads'}`,
      detail: 'High or emergency urgency — needs follow-up',
      color:  '#FB923C',
      bg:     'rgba(251,146,60,0.08)',
      border: 'rgba(251,146,60,0.25)',
    })
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 mb-6">
        <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
        <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">All Clear</span>
        <span className="text-xs font-mono text-slate-600">— no pending actions</span>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-2">
        // ACTION QUEUE
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-150 hover:brightness-110"
            style={{ background: item.bg, borderColor: item.border }}
          >
            <span style={{ color: item.color }} className="flex-shrink-0 mt-0.5">
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none" style={{ color: item.color }}>
                {item.label}
              </p>
              <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">
                {item.detail}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

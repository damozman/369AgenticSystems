'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Brain,
  Clock,
  Phone,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import ThemeToggle from './ThemeToggle'

const NAV = [
  {
    href: '/dashboard',
    label: 'Overview',
    Icon: LayoutDashboard,
    sub: null,
  },
  {
    href: '/workforce',
    label: 'Workforce',
    Icon: Users,
    sub: 'Active Digital Employees',
  },
  {
    href: '/intelligence',
    label: 'Intelligence Vault',
    Icon: Brain,
    sub: 'Business Memory',
  },
  {
    href: '/history',
    label: 'Deployment History',
    Icon: Clock,
    sub: 'Dossier Logs',
  },
  {
    href: '/receptionist',
    label: 'Receptionist',
    Icon: Phone,
    sub: 'Call Activity',
  },
]

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isClientPortal = pathname.startsWith('/client-dashboard')

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-64 h-full min-h-screen bg-[var(--bg-sidebar)] border-r border-[var(--border-gold)] flex-shrink-0">

      {/* ── Logo ───────────────────────────────────────────────── */}
      <div className="px-6 py-6 border-b border-[var(--border-gold)]">
        <Link href={isClientPortal ? '/client-dashboard' : '/dashboard'} className="group block">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-[#D4AF37] group-hover:text-[#F0C94A] transition-colors">
              369
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.25em]">
              Agentic
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5 uppercase tracking-[0.25em]">
            {isClientPortal ? 'Client Portal' : 'Command Center'}
          </p>
        </Link>
      </div>

      {/* ── System status ──────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-[var(--border-faint)]">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
            System Operational
          </span>
        </div>
      </div>

      {/* ── Navigation — admin only; client portal is a single page ──────── */}
      {!isClientPortal && (
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, Icon, sub }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={[
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 border',
                isActive
                  ? 'bg-[rgba(212,175,55,0.07)] text-[#D4AF37] border-[var(--border-gold-mid)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--metric-bg)] border-transparent',
              ].join(' ')}
            >
              <Icon
                size={15}
                className={isActive
                  ? 'text-[#D4AF37]'
                  : 'text-slate-600 group-hover:text-slate-400 transition-colors'
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none">{label}</p>
                {sub && (
                  <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{sub}</p>
                )}
              </div>
              {isActive && (
                <ChevronRight size={11} className="text-[#D4AF37] flex-shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>
      )}
      {isClientPortal && <div className="flex-1" />}

      {/* ── Footer / sign out ──────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-[var(--border-faint)]">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-600 hover:text-slate-300 hover:bg-[var(--metric-bg)] transition-all duration-150 group"
        >
          <LogOut size={15} className="group-hover:text-red-400 transition-colors" />
          <span className="text-sm">Sign Out</span>
        </button>
        <ThemeToggle
          showLabel
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-600 hover:text-slate-300 hover:bg-[var(--metric-bg)] transition-all duration-150"
        />
        <p className="text-[9px] font-mono text-slate-800 text-center mt-3">
          369 Agentic Systems v1.0
        </p>
      </div>

    </aside>
  )
}

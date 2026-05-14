'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Brain,
  Clock,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const NAV = [
  {
    href: '/portal/dashboard',
    label: 'Overview',
    Icon: LayoutDashboard,
    sub: null,
  },
  {
    href: '/portal/workforce',
    label: 'Workforce',
    Icon: Users,
    sub: 'Active Digital Employees',
  },
  {
    href: '/portal/intelligence',
    label: 'Intelligence Vault',
    Icon: Brain,
    sub: 'Business Memory',
  },
  {
    href: '/portal/history',
    label: 'Deployment History',
    Icon: Clock,
    sub: 'Dossier Logs',
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-[#0A0A0A] border-r border-[rgba(212,175,55,0.1)] flex-shrink-0">

      {/* ── Logo ───────────────────────────────────────────────── */}
      <div className="px-6 py-6 border-b border-[rgba(212,175,55,0.08)]">
        <Link href="/portal/dashboard" className="group block">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-[#D4AF37] group-hover:text-[#F0C94A] transition-colors">
              369
            </span>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.25em]">
              Agentic
            </span>
          </div>
          <p className="text-[9px] font-mono text-slate-700 mt-0.5 uppercase tracking-[0.25em]">
            Command Center
          </p>
        </Link>
      </div>

      {/* ── System status ──────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-[rgba(255,255,255,0.04)]">
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

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, Icon, sub }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={[
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 border',
                isActive
                  ? 'bg-[rgba(212,175,55,0.07)] text-[#D4AF37] border-[rgba(212,175,55,0.18)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[rgba(255,255,255,0.03)] border-transparent',
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
                  <p className="text-[10px] font-mono text-slate-700 mt-0.5 truncate">{sub}</p>
                )}
              </div>
              {isActive && (
                <ChevronRight size={11} className="text-[#D4AF37] flex-shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer / sign out ──────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-[rgba(255,255,255,0.04)]">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-600 hover:text-slate-300 hover:bg-[rgba(255,255,255,0.03)] transition-all duration-150 group"
        >
          <LogOut size={15} className="group-hover:text-red-400 transition-colors" />
          <span className="text-sm">Sign Out</span>
        </button>
        <p className="text-[9px] font-mono text-slate-800 text-center mt-3">
          369 Agentic Systems v1.0
        </p>
      </div>

    </aside>
  )
}

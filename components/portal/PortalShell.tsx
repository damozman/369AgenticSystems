'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import ThemeToggle from './ThemeToggle'

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const isClientPortal = pathname.startsWith('/client-dashboard')

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas drawer on mobile, static column on md+ */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
          'md:relative md:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Sidebar onClose={() => setDrawerOpen(false)} />
      </div>

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar — hidden on md+ */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-[var(--bg-sidebar)] border-b border-[var(--border-gold)] flex-shrink-0 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-display font-bold text-[#D4AF37]">369</span>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Agentic</span>
          </div>

          {isClientPortal && (
            <ThemeToggle className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors" />
          )}
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

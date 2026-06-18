'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { SystemAudit } from './ActiveSpecialists'

type Tag = 'INFO' | 'PROCESS' | 'SUCCESS' | 'WARN' | 'SYSTEM'

interface LogEntry {
  id: number
  time: string
  tag: Tag
  agent?: string
  msg: string
}

function seedLog(): LogEntry {
  return { id: globalId++, time: now(), tag: 'SYSTEM', msg: '369 Agentic Core online — awaiting live audit events' }
}

const TAG_COLOR: Record<Tag, string> = {
  INFO:    '#60A5FA',
  PROCESS: '#D4AF37',
  SUCCESS: '#4ADE80',
  WARN:    '#F59E0B',
  SYSTEM:  '#94A3B8',
}

// Copper-amber palette — sophisticated, not neon
const WARN_ROW_BG     = 'rgba(120, 53, 15, 0.18)'  // amber-900 family tint
const WARN_ROW_BORDER = '#92400E'                    // amber-800, copper-like
const WARN_TAG_COLOR  = '#F59E0B'                    // amber-500
const WARN_TAG_BG     = 'rgba(245, 158, 11, 0.12)'
const WARN_MSG_COLOR  = '#FDE68A'                    // amber-200, warm readable

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function fireNotification(msg: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification('⚠ 369 Agentic — Action Required', {
      body: msg,
      icon: '/favicon.ico',
    })
  }
}

const NEAR_BOTTOM_THRESHOLD = 100
let globalId = 100

export default function LiveFeed() {
  const [logs, setLogs]               = useState<LogEntry[]>(() => [seedLog()])
  const [hasRealEvents, setHasRealEvents] = useState(false)
  const [warnFilter, setWarnFilter]   = useState(false)
  const [unreadWarns, setUnreadWarns] = useState(0)
  const scrollRef     = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)

  // Request browser notification permission on first render
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD
  }

  // Auto-scroll when near bottom
  useEffect(() => {
    if (!nearBottomRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  // Real-time Supabase events — push notifications on real WARNs only
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('audit_live_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_audits' },
        (payload) => {
          const audit   = payload.new as SystemAudit
          const timestamp = now()

          const entries: Omit<LogEntry, 'id' | 'time'>[] = [
            { tag: 'INFO', agent: 'AUDIT_ENGINE', msg: `New audit received — ${audit.client_domain}` },
          ]
          if (audit.security_score != null) {
            entries.push({ tag: 'PROCESS', agent: 'SECURITY_SCAN', msg: `Security score: ${audit.security_score}/100` })
          }
          if (audit.leak_detected) {
            const warnMsg = `Leak detected on ${audit.client_domain} — flagged for review`
            entries.push({ tag: 'WARN', agent: 'SECURITY_SCAN', msg: warnMsg })
            setUnreadWarns(n => n + 1)
            fireNotification(warnMsg)
          }
          if (audit.seo_visibility != null) {
            entries.push({ tag: 'PROCESS', agent: 'SEO_ENGINE', msg: `SEO visibility index: ${audit.seo_visibility}` })
          }
          if (audit.roi_multiplier != null) {
            entries.push({ tag: 'SUCCESS', agent: 'ROI_ENGINE', msg: `ROI multiplier locked in: ${audit.roi_multiplier}x — ${audit.client_domain}` })
          }

          setHasRealEvents(true)
          setLogs(prev => [
            ...prev.slice(-40),
            ...entries.map(e => ({ ...e, id: globalId++, time: timestamp })),
          ])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function toggleWarnFilter() {
    if (!warnFilter) setUnreadWarns(0) // entering filter mode — mark all seen
    setWarnFilter(f => !f)
  }

  const warnTotal    = logs.filter(l => l.tag === 'WARN').length
  const displayedLogs = warnFilter ? logs.filter(l => l.tag === 'WARN') : logs
  const showBadge    = warnTotal > 0 || warnFilter

  return (
    <div className="flex flex-col h-[520px]">

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-0.5">
            // LIVE FEED
          </p>
          <h2 className="text-lg font-display font-semibold text-white">Agent Activity</h2>
        </div>

        <div className="flex items-center gap-2">

          {/* ── WARN triage badge / filter toggle ── */}
          {showBadge && (
            <button
              onClick={toggleWarnFilter}
              title={warnFilter ? 'Clear filter — show all activity' : 'Filter to WARN events only'}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-200',
                warnFilter
                  ? 'bg-[rgba(120,53,15,0.35)] border-[#92400E] text-amber-400'
                  : 'bg-[rgba(120,53,15,0.15)] border-[#78350F] text-amber-600 hover:bg-[rgba(120,53,15,0.28)] hover:border-[#92400E] hover:text-amber-400',
              ].join(' ')}
            >
              {warnFilter ? (
                <>
                  <X size={9} />
                  <span>WARN ONLY</span>
                </>
              ) : (
                <>
                  {unreadWarns > 0 ? (
                    <motion.span
                      animate={{ opacity: [1, 0.35, 1] }}
                      transition={{ duration: 1.1, repeat: Infinity }}
                    >
                      ⚠
                    </motion.span>
                  ) : (
                    <Filter size={9} />
                  )}
                  <span>{unreadWarns > 0 ? unreadWarns : warnTotal} WARN</span>
                </>
              )}
            </button>
          )}

          {/* LIVE indicator */}
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-red-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
          <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest">LIVE</span>
        </div>
      </div>

      {/* Terminal window */}
      <div className="flex-1 bg-[var(--bg-terminal)] rounded-xl border border-[var(--border-gold)] overflow-hidden flex flex-col">

        {/* Terminal chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] flex-shrink-0">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <span className="text-[9px] font-mono text-slate-500 ml-2">
            369-agentic-core — live-feed
            {warnFilter && (
              <span style={{ color: '#B45309' }} className="ml-2">[ WARN FILTER ACTIVE ]</span>
            )}
          </span>
        </div>

        {/* Log stream */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px]"
        >
          <AnimatePresence initial={false}>
            {displayedLogs.map(log => {
              const isWarn = log.tag === 'WARN'
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2 overflow-hidden rounded-sm py-0.5"
                  style={isWarn ? {
                    background:   WARN_ROW_BG,
                    borderLeft:   `2px solid ${WARN_ROW_BORDER}`,
                    paddingLeft:  '6px',
                    marginLeft:   '-4px',
                    paddingRight: '4px',
                  } : {}}
                >
                  <span className="text-slate-500 flex-shrink-0 tabular-nums" suppressHydrationWarning>{log.time}</span>
                  <span
                    className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider"
                    style={{
                      color:      isWarn ? WARN_TAG_COLOR  : TAG_COLOR[log.tag],
                      background: isWarn ? WARN_TAG_BG     : `${TAG_COLOR[log.tag]}18`,
                    }}
                  >
                    {log.tag}
                  </span>
                  {log.agent && (
                    <span
                      className="flex-shrink-0"
                      style={{ color: isWarn ? '#D97706' : '#94A3B8' }}
                    >
                      [{log.agent}]
                    </span>
                  )}
                  <span
                    className="truncate min-w-0"
                    style={{ color: isWarn ? WARN_MSG_COLOR : '#CBD5E1' }}
                  >
                    {log.msg}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Empty state when filter active with no WARNs */}
          {warnFilter && displayedLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <span className="text-[10px] font-mono text-slate-700 uppercase tracking-widest">All clear</span>
              <span className="text-[9px] font-mono text-slate-800">No active warnings in current window</span>
            </div>
          )}

          {/* Awaiting real events indicator */}
          {!warnFilter && !hasRealEvents && (
            <div className="flex items-center gap-2 pt-2">
              <motion.span
                className="inline-block w-1.5 h-1.5 rounded-full bg-slate-600"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <span className="text-[10px] font-mono text-slate-700">awaiting live audit events...</span>
            </div>
          )}

          {/* Blinking cursor — hidden in filter mode */}
          {!warnFilter && (
            <div className="flex items-center gap-1 pt-0.5">
              <span className="text-[#D4AF37]">›</span>
              <motion.span
                className="inline-block w-1.5 h-3.5 bg-[#D4AF37]"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.7, repeat: Infinity, repeatType: 'reverse' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

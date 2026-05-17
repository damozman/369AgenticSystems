'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

const SEED_LOGS: Omit<LogEntry, 'id'>[] = [
  { time: '09:41:02', tag: 'SYSTEM',  msg: '369 Agentic Core initialized — 4 specialists online' },
  { time: '09:41:06', tag: 'INFO',    agent: 'RESPONSE_SPEC',  msg: 'Lead intake received — qualifying [ROOFING_0047]' },
  { time: '09:41:09', tag: 'PROCESS', agent: 'RESPONSE_SPEC',  msg: 'Fetching business memory context...' },
  { time: '09:41:11', tag: 'INFO',    agent: 'RESPONSE_SPEC',  msg: '3 prior pain points loaded from vault' },
  { time: '09:41:14', tag: 'PROCESS', agent: 'DOC_DRAFTER',    msg: 'Onboarding dossier initiated for [ROOFING_0047]' },
  { time: '09:41:18', tag: 'INFO',    agent: 'SYSTEM',         msg: 'ROI estimate: $18,400/mo recovery' },
  { time: '09:41:22', tag: 'PROCESS', agent: 'FOLLOW_UP',      msg: 'Day-2 sequence armed — trigger: T+24h' },
  { time: '09:41:25', tag: 'SUCCESS', agent: 'DOC_DRAFTER',    msg: 'Dossier dispatched to client_email ✓' },
]

const LIVE_QUEUE: Omit<LogEntry, 'id' | 'time'>[] = [
  { tag: 'INFO',    agent: 'RESPONSE_SPEC',  msg: 'New intake received — [DENTAL_0023]' },
  { tag: 'PROCESS', agent: 'APPT_GUARDIAN',  msg: 'Checking appointment availability...' },
  { tag: 'INFO',    agent: 'SYSTEM',         msg: 'Memory query: 2 prior dental pain points found' },
  { tag: 'SUCCESS', agent: 'APPT_GUARDIAN',  msg: 'Slot offered — awaiting confirmation' },
  { tag: 'WARN',    agent: 'FOLLOW_UP',      msg: '[ROOFING_0032] Day-3 sequence triggered' },
  { tag: 'PROCESS', agent: 'DOC_DRAFTER',    msg: 'Generating supplement analysis...' },
  { tag: 'SUCCESS', agent: 'CLAIMS_TRIAGE',  msg: 'Insurance claim pre-qualified — $12,800 recovery' },
  { tag: 'SYSTEM',  msg: 'Memory write: new ROI data point stored in vault' },
]

const TAG_COLOR: Record<Tag, string> = {
  INFO:    '#60A5FA',
  PROCESS: '#D4AF37',
  SUCCESS: '#4ADE80',
  WARN:    '#F59E0B',
  SYSTEM:  '#94A3B8',
}

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

const NEAR_BOTTOM_THRESHOLD = 100

let globalId = 100

export default function LiveFeed() {
  const [logs, setLogs] = useState<LogEntry[]>(
    SEED_LOGS.map(l => ({ ...l, id: globalId++ }))
  )
  const [qIdx, setQIdx] = useState(0)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true) // ref avoids re-renders on every scroll event

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    nearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD
  }

  useEffect(() => {
    const id = setInterval(() => {
      const entry = LIVE_QUEUE[qIdx % LIVE_QUEUE.length]
      setLogs(prev => [...prev.slice(-40), { ...entry, id: globalId++, time: now() }])
      setQIdx(i => i + 1)
    }, 3400)
    return () => clearInterval(id)
  }, [qIdx])

  useEffect(() => {
    if (!nearBottomRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  // Real-time: append log entries whenever a new system_audit row lands
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('audit_live_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_audits' },
        (payload) => {
          const audit = payload.new as SystemAudit
          const timestamp = now()

          const entries: Omit<LogEntry, 'id' | 'time'>[] = [
            { tag: 'INFO',    agent: 'AUDIT_ENGINE',  msg: `New audit received — ${audit.client_domain}` },
          ]
          if (audit.security_score != null) {
            entries.push({ tag: 'PROCESS', agent: 'SECURITY_SCAN', msg: `Security score: ${audit.security_score}/100` })
          }
          if (audit.leak_detected) {
            entries.push({ tag: 'WARN', agent: 'SECURITY_SCAN', msg: `Leak detected on ${audit.client_domain} — flagged for review` })
          }
          if (audit.seo_visibility != null) {
            entries.push({ tag: 'PROCESS', agent: 'SEO_ENGINE', msg: `SEO visibility index: ${audit.seo_visibility}` })
          }
          if (audit.roi_multiplier != null) {
            entries.push({ tag: 'SUCCESS', agent: 'ROI_ENGINE', msg: `ROI multiplier locked in: ${audit.roi_multiplier}x — ${audit.client_domain}` })
          }

          setLogs(prev => [
            ...prev.slice(-40),
            ...entries.map(e => ({ ...e, id: globalId++, time: timestamp })),
          ])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

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
          <span className="text-[9px] font-mono text-slate-700 ml-2">
            369-agentic-core — live-feed
          </span>
        </div>

        {/* Log stream */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[13px]"
        >
          <AnimatePresence initial={false}>
            {logs.map(log => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-start gap-2 leading-relaxed"
              >
                <span className="text-slate-700 flex-shrink-0 tabular-nums">{log.time}</span>
                <span
                  className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider"
                  style={{
                    color: TAG_COLOR[log.tag],
                    background: `${TAG_COLOR[log.tag]}18`,
                  }}
                >
                  {log.tag}
                </span>
                {log.agent && (
                  <span className="text-slate-600 flex-shrink-0">[{log.agent}]</span>
                )}
                <span className="text-slate-300">{log.msg}</span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Blinking cursor */}
          <div className="flex items-center gap-1 pt-0.5">
            <span className="text-[#D4AF37]">›</span>
            <motion.span
              className="inline-block w-1.5 h-3.5 bg-[#D4AF37]"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, repeatType: 'reverse' }}
            />
          </div>

        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ScanCard from './ScanCard'
import { createClient } from '@/lib/supabase'

export interface SystemAudit {
  id?: string
  created_at: string
  client_domain: string
  security_score: number | null
  seo_visibility: number | null
  lead_velocity: number | null
  leak_detected: boolean | null
  roi_multiplier: number | null
  payload_status: string | null
}

type DisplayStatus = 'active' | 'processing' | 'idle'

function deriveStatus(payload_status: string | null): DisplayStatus {
  const s = (payload_status ?? '').toLowerCase()
  if (s === 'active' || s === 'deployed' || s === 'live') return 'active'
  if (s === 'processing' || s === 'pending' || s === 'queued') return 'processing'
  return 'idle'
}

const ACCENT_COLORS = ['#F59E0B', '#14B8A6', '#60A5FA', '#EC4899', '#A78BFA', '#4ADE80', '#F97316']

function getAccent(index: number) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_DOT: Record<DisplayStatus, string> = {
  active:     '#4ADE80',
  processing: '#F59E0B',
  idle:       '#475569',
}

const STATUS_LABEL: Record<DisplayStatus, string> = {
  active:     'ACTIVE',
  processing: 'PROCESSING',
  idle:       'IDLE',
}

function AuditCard({ audit, index, delay }: { audit: SystemAudit; index: number; delay: number }) {
  const status      = deriveStatus(audit.payload_status)
  const accentColor = getAccent(index)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <ScanCard accentColor={accentColor} scanDelay={delay * 1.2} className="h-full">
        <div className="p-5">

          {/* Domain header */}
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1 mr-3">
              <p
                className="text-[10px] font-mono uppercase tracking-widest mb-1"
                style={{ color: accentColor }}
              >
                CLIENT AUDIT
              </p>
              <h3 className="text-white font-semibold text-sm leading-tight truncate">
                {audit.client_domain}
              </h3>
              <p className="text-[10px] font-mono text-slate-600 mt-0.5 capitalize">
                {audit.payload_status ?? 'unknown'}
              </p>
            </div>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}28` }}
            >
              {audit.leak_detected ? (
                <span className="text-[9px] font-bold text-red-400">!</span>
              ) : (
                <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
              )}
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-1.5 mb-4">
            {status === 'active' ? (
              <motion.div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: STATUS_DOT[status] }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            ) : (
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: STATUS_DOT[status] }}
              />
            )}
            <span
              className="text-[9px] font-mono tracking-widest"
              style={{ color: STATUS_DOT[status] }}
            >
              {STATUS_LABEL[status]}
            </span>
            {audit.leak_detected && (
              <span className="text-[9px] font-mono text-red-400 ml-auto tracking-wider">
                LEAK DETECTED
              </span>
            )}
          </div>

          {/* Top 3 key metrics */}
          <div className="grid grid-cols-3 gap-1.5 mb-1.5">
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2">
              <p className="text-[8px] font-mono text-slate-700 uppercase tracking-wider">Security</p>
              <p className="text-base font-bold text-white mt-0.5">
                {audit.security_score ?? '—'}
              </p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2">
              <p className="text-[8px] font-mono text-slate-700 uppercase tracking-wider">SEO Vis.</p>
              <p className="text-base font-bold text-white mt-0.5">
                {audit.seo_visibility ?? '—'}
              </p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2">
              <p className="text-[8px] font-mono text-slate-700 uppercase tracking-wider">Lead Vel.</p>
              <p className="text-base font-bold text-white mt-0.5">
                {audit.lead_velocity ?? '—'}
              </p>
            </div>
          </div>

          {/* ROI + timestamp */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2">
              <p className="text-[8px] font-mono text-slate-700 uppercase tracking-wider">ROI</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: accentColor }}>
                {audit.roi_multiplier != null ? `${audit.roi_multiplier}x` : '—'}
              </p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2">
              <p className="text-[8px] font-mono text-slate-700 uppercase tracking-wider">Last Active</p>
              <p className="text-[10px] font-mono text-slate-300 mt-0.5">
                {timeAgo(audit.created_at)}
              </p>
            </div>
          </div>

        </div>
      </ScanCard>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full border border-[#D4AF37]/20 flex items-center justify-center mb-4">
        <motion.div
          className="w-2 h-2 rounded-full bg-[#D4AF37]"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      <p className="text-[10px] font-mono text-slate-700 uppercase tracking-widest">
        AWAITING AUDIT DATA
      </p>
      <p className="text-xs text-slate-600 mt-1">No system audits on record — standing by</p>
    </div>
  )
}

interface Props {
  initialAudits: SystemAudit[]
}

export default function ActiveSpecialists({ initialAudits }: Props) {
  const [audits, setAudits] = useState<SystemAudit[]>(initialAudits ?? [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('system_audits_inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_audits' },
        (payload) => {
          setAudits(prev => [payload.new as SystemAudit, ...(prev ?? [])])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const safeAudits = audits ?? []
  const activeCount = safeAudits.filter(a => deriveStatus(a.payload_status) === 'active').length

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-0.5">
            // INTELLIGENCE GRID
          </p>
          <h2 className="text-lg font-display font-semibold text-white">System Audits</h2>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs font-mono text-slate-500">
            {safeAudits.length > 0 ? `${activeCount} active` : 'no data'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {safeAudits.length === 0 ? (
          <EmptyState />
        ) : (
          safeAudits.map((audit, i) => (
            <AuditCard key={audit.id ?? `${audit.created_at}_${audit.client_domain}`} audit={audit} index={i} delay={i * 0.08} />
          ))
        )}
      </div>
    </section>
  )
}

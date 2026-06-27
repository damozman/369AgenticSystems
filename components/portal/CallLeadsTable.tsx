'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface Lead {
  id:                string
  created_at:        string
  client_domain:     string
  caller_name:       string | null
  caller_phone:      string
  caller_address:    string | null
  caller_email:      string | null
  issue_description: string | null
  urgency:           string | null
  status:            string | null
  call_id:           string | null
}

interface CallTranscript {
  transcript:       string | null
  duration_seconds: number | null
}

const URGENCY_STYLE: Record<string, { text: string; bg: string }> = {
  emergency: { text: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  high:      { text: '#FB923C', bg: 'rgba(251,146,60,0.12)'  },
  normal:    { text: '#94A3B8', bg: 'rgba(148,163,184,0.10)' },
  low:       { text: '#64748B', bg: 'rgba(100,116,139,0.10)' },
}

function urgencyStyle(u: string | null) {
  return URGENCY_STYLE[(u ?? '').toLowerCase()] ?? URGENCY_STYLE.normal
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtDuration(seconds: number | null) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function exportCSV(leads: Lead[]) {
  const headers = ['Date', 'Name', 'Phone', 'Email', 'Address', 'Domain', 'Issue', 'Urgency', 'Status']
  const rows = leads.map(l => [
    new Date(l.created_at).toLocaleString(),
    l.caller_name ?? '',
    l.caller_phone,
    l.caller_email ?? '',
    l.caller_address ?? '',
    l.client_domain,
    (l.issue_description ?? '').replace(/"/g, '""'),
    l.urgency ?? 'normal',
    l.status ?? 'open',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `leads-${new Date().toISOString().slice(0, 10)}.csv`,
  })
  a.click()
  URL.revokeObjectURL(url)
}

export default function CallLeadsTable() {
  const [leads, setLeads]               = useState<Lead[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [callData, setCallData]         = useState<CallTranscript | null>(null)
  const [callLoading, setCallLoading]   = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchLeads() {
      const { data } = await supabase
        .from('leads')
        .select('id,created_at,client_domain,caller_name,caller_phone,caller_address,caller_email,issue_description,urgency,status,call_id')
        .order('created_at', { ascending: false })
        .limit(50)
      if (mounted) {
        setLeads(data ?? [])
        setLoading(false)
      }
    }

    fetchLeads()

    const channel = supabase
      .channel('call_leads_table')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        if (!mounted) return
        setLeads(prev => [payload.new as Lead, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        if (!mounted) return
        const updated = payload.new as Lead
        setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const openLead = useCallback(async (lead: Lead) => {
    setSelectedLead(lead)
    setCallData(null)

    if (!lead.call_id) return

    setCallLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('calls')
      .select('transcript,duration_seconds')
      .eq('id', lead.call_id)
      .maybeSingle()
    setCallData(data ?? null)
    setCallLoading(false)
  }, [])

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-0.5">
            // INBOUND LEADS
          </p>
          <h2 className="text-lg font-display font-semibold text-white">
            Captured Leads
            <span className="ml-2 text-sm font-mono font-normal text-slate-500">
              {leads.length}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {leads.length > 0 && (
            <button
              onClick={() => exportCSV(leads)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-slate-400 hover:text-slate-200 hover:border-[var(--border-gold)] transition-colors text-[11px] font-mono"
            >
              <Download size={11} />
              Export CSV
            </button>
          )}
          <div className="flex items-center gap-2">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs font-mono text-slate-400">real-time</span>
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-terminal)] rounded-xl border border-[var(--border-gold)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
                {['Name', 'Phone', 'Domain', 'Issue', 'Urgency', 'Status', 'Date'].map(col => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-left text-[9px] uppercase tracking-widest text-slate-600 font-bold whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-700">
                    Loading…
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-700">
                    No leads yet — make a test call to see data here.
                  </td>
                </tr>
              ) : (
                leads.map((lead, i) => {
                  const urg = urgencyStyle(lead.urgency)
                  return (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => openLead(lead)}
                      className="border-b border-[var(--border-faint)] hover:bg-[var(--item-bg)] transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2.5 text-slate-200 font-medium truncate max-w-[140px]">
                        {lead.caller_name ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 tabular-nums">
                        {lead.caller_phone}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 truncate max-w-[120px]">
                        {lead.client_domain}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 truncate max-w-[160px]">
                        {lead.issue_description
                          ? lead.issue_description.substring(0, 40) + (lead.issue_description.length > 40 ? '…' : '')
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: urg.text, background: urg.bg }}
                        >
                          {lead.urgency ?? 'normal'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 capitalize">
                        {lead.status ?? 'open'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                        {fmt(lead.created_at)}
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead detail modal */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="w-full max-w-lg bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-gold-mid)] overflow-hidden flex flex-col"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-subtle)] flex-shrink-0">
              <div className="min-w-0">
                <p className="text-[9px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] mb-1">
                  // LEAD DETAIL
                </p>
                <p className="text-base font-display font-semibold text-white truncate">
                  {selectedLead.caller_name ?? 'Unknown Caller'}
                </p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  {selectedLead.caller_phone} · {fmt(selectedLead.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors flex-shrink-0 ml-3"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[
                  { label: 'Urgency', value: selectedLead.urgency ?? 'normal' },
                  { label: 'Status',  value: selectedLead.status  ?? 'open'   },
                  { label: 'Domain',  value: selectedLead.client_domain        },
                  { label: 'Email',   value: selectedLead.caller_email ?? '—'  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mb-0.5">{label}</p>
                    <p className="text-[11px] font-mono text-slate-300 break-all">{value}</p>
                  </div>
                ))}
                {selectedLead.caller_address && (
                  <div className="col-span-2">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mb-0.5">Address</p>
                    <p className="text-[11px] font-mono text-slate-300">{selectedLead.caller_address}</p>
                  </div>
                )}
              </div>

              {/* Full issue */}
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mb-1.5">Issue Description</p>
                <div className="bg-[var(--bg-terminal)] rounded-xl px-4 py-3 text-[12px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedLead.issue_description ?? 'No issue captured.'}
                </div>
              </div>

              {/* Transcript */}
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mb-1.5">
                  Call Transcript
                  {callData?.duration_seconds && (
                    <span className="ml-2 normal-case text-slate-700">· {fmtDuration(callData.duration_seconds)}</span>
                  )}
                </p>
                {!selectedLead.call_id ? (
                  <p className="text-[11px] font-mono text-slate-700 italic">No linked call record.</p>
                ) : callLoading ? (
                  <p className="text-[11px] font-mono text-slate-700">Loading transcript…</p>
                ) : callData?.transcript ? (
                  <div className="bg-[var(--bg-terminal)] rounded-xl px-4 py-3 text-[12px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {callData.transcript}
                  </div>
                ) : (
                  <p className="text-[11px] font-mono text-slate-700 italic">No transcript available for this call.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

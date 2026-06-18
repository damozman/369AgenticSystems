'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase'

interface Lead {
  id:                string
  created_at:        string
  client_domain:     string
  caller_name:       string | null
  caller_phone:      string
  caller_address:    string | null
  issue_description: string | null
  urgency:           string | null
  status:            string | null
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

export default function CallLeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchLeads() {
      const { data } = await supabase
        .from('leads')
        .select('*')
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          if (!mounted) return
          setLeads(prev => [payload.new as Lead, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          if (!mounted) return
          const updated = payload.new as Lead
          setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
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
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs font-mono text-slate-400">real-time</span>
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
                      className="border-b border-[var(--border-faint)] hover:bg-[var(--item-bg)] transition-colors"
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
    </div>
  )
}

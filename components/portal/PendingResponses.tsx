'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Mail, CheckCircle, XCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react'

interface PendingResponse {
  id: string
  created_at: string
  prospect_email: string
  prospect_name: string | null
  prospect_domain: string | null
  original_subject: string | null
  original_body: string | null
  draft_subject: string
  draft_body: string
  status: 'pending' | 'sent' | 'rejected'
  sent_at: string | null
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function ResponseCard({ item, onAction }: {
  item: PendingResponse
  onAction: (id: string, action: 'approve' | 'reject') => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading]   = useState<'approve' | 'reject' | null>(null)

  async function handle(action: 'approve' | 'reject') {
    setLoading(action)
    try {
      await onAction(item.id, action)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[rgba(212,175,55,0.15)] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-start justify-between p-4 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] flex-shrink-0 animate-pulse" />
            <p className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-wider truncate">
              {item.prospect_name || item.prospect_email}
              {item.prospect_domain && (
                <span className="text-slate-500 ml-1">· {item.prospect_domain}</span>
              )}
            </p>
          </div>
          <p className="text-sm font-medium text-white truncate">{item.draft_subject}</p>
          <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            {timeAgo(item.created_at)} · re: "{item.original_subject}"
          </p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-slate-400 hover:text-white flex-shrink-0 mt-0.5"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* ── Draft preview ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {item.original_body && (
            <div className="rounded-lg bg-[rgba(15,23,42,0.6)] border border-slate-800 p-3">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Their message</p>
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-4">
                {item.original_body}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-[rgba(212,175,55,0.05)] border border-[rgba(212,175,55,0.2)] p-3">
            <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-wider mb-1.5">Draft response</p>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{item.draft_body}</p>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex border-t border-slate-800">
        <button
          onClick={() => handle('reject')}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono text-slate-400 hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.05)] transition-colors disabled:opacity-40"
        >
          <XCircle size={13} />
          {loading === 'reject' ? 'REJECTING...' : 'REJECT'}
        </button>
        <div className="w-px bg-slate-800" />
        <button
          onClick={() => handle('approve')}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono text-[#D4AF37] hover:text-white hover:bg-[rgba(212,175,55,0.1)] transition-colors disabled:opacity-40"
        >
          <CheckCircle size={13} />
          {loading === 'approve' ? 'SENDING...' : 'AUTHORIZE SEND'}
        </button>
      </div>
    </div>
  )
}

export default function PendingResponses() {
  const [items, setItems] = useState<PendingResponse[]>([])

  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    supabase
      .from('pending_responses')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setItems(data as PendingResponse[]) })

    // Realtime subscription
    const channel = supabase
      .channel('pending_responses')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pending_responses' }, (p) => {
        if ((p.new as PendingResponse).status === 'pending') {
          setItems(prev => [p.new as PendingResponse, ...prev])
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pending_responses' }, (p) => {
        const updated = p.new as PendingResponse
        if (updated.status !== 'pending') {
          setItems(prev => prev.filter(i => i.id !== updated.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    const res = await fetch('/api/send-response', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ responseId: id, action }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[PendingResponses] action failed:', err)
      throw new Error(err.error)
    }
  }

  return (
    <div className="mt-6">
      {/* ── Section header ── */}
      <div className="flex items-center gap-3 mb-4">
        <Mail size={15} className="text-[#D4AF37]" />
        <p className="text-[11px] font-mono text-slate-400 uppercase tracking-[0.2em]">
          // PENDING RESPONSES
        </p>
        {items.length > 0 && (
          <span className="ml-auto text-[10px] font-mono bg-[rgba(212,175,55,0.15)] text-[#D4AF37] px-2 py-0.5 rounded-full">
            {items.length} awaiting approval
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-slate-800 p-6 text-center">
          <Mail size={20} className="text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-mono">No pending responses</p>
          <p className="text-xs text-slate-600 mt-1">
            When prospects reply to your emails, AI-drafted responses will appear here for your approval.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {items.map(item => (
            <ResponseCard key={item.id} item={item} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

/**
 * Approve or decline. A POST, never a link.
 *
 * The button is the only thing that can send. A signed URL in an email cannot, because mail
 * scanners and link-preview bots fetch every URL in a message, and a fetched approval would mail a
 * prospect a document no human had read.
 */
import { useState } from 'react'

export default function ApproveForm({ id, token, to }: { id: string; token: string; to: string }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  async function act(action: 'approve' | 'decline') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/dossier/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, t: token, action, reason: reason || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`)
        return
      }
      setDone(action === 'approve' ? `Sent to ${to}.` : 'Declined. Nothing was sent.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <p style={{ marginTop: 20, color: '#4ADE80', fontSize: 15 }}>{done}</p>
  }

  return (
    <div style={{ marginTop: 22 }}>
      {error && (
        <p role="alert" style={{ color: '#FCA5A5', fontSize: 14, marginBottom: 14, lineHeight: 1.6 }}>
          {error}
        </p>
      )}

      <button
        onClick={() => act('approve')}
        disabled={busy}
        style={{
          background: '#D4AF37', color: '#0A0A0A', border: 'none', borderRadius: 8,
          padding: '14px 22px', fontSize: 15, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', minHeight: 48,
        }}
      >
        {busy ? 'Working…' : `Approve and send to ${to}`}
      </button>

      <div style={{ marginTop: 26, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <label
          htmlFor="decline-reason"
          style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 8, lineHeight: 1.6 }}
        >
          Not right? Say why — it is the record of what was wrong with it.
        </label>
        <input
          id="decline-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. the website section reads wrong"
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 8, minHeight: 44,
            background: 'rgba(255,255,255,0.04)', color: '#E2E8F0',
            border: '1px solid rgba(148,163,184,0.2)', fontSize: 14, marginBottom: 12,
          }}
        />
        <button
          onClick={() => act('decline')}
          disabled={busy}
          style={{
            background: 'transparent', color: '#94A3B8', borderRadius: 8, minHeight: 44,
            border: '1px solid rgba(148,163,184,0.3)', padding: '12px 18px',
            fontSize: 14, cursor: busy ? 'wait' : 'pointer',
          }}
        >
          Decline
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

export default function ChangeRequestForm({ siteId }: { siteId: string }) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ message: string; billable: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/lead-engine/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send that.')
      setResult({ message: data.message, billable: data.billable })
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        className="w-full rounded-lg border border-[var(--border-faint)] bg-transparent p-3 text-sm text-[var(--text-primary)]"
        rows={3}
        placeholder="What would you like changed?"
        value={body}
        onChange={e => setBody(e.target.value)}
        required
      />
      {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
      {result && (
        <p className="text-xs mt-1.5" style={{ color: result.billable ? '#F59E0B' : '#4ADE80' }}>
          Sent. {result.message}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || !body.trim()}
        className="mt-2 px-4 py-2 rounded-lg text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: '#D4AF37', color: '#000' }}
      >
        {submitting ? 'Sending…' : 'Send request'}
      </button>
    </form>
  )
}

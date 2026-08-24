'use client'

/**
 * The real lead form, replacing `LeadFormPlaceholder` (Chunk A's inert stand-in — same four
 * fields, same `.le-field`/`.le-submit` classes, so this ships with no visual change to a page
 * Chris has already reviewed).
 *
 * Posts to `POST /api/lead-engine/submit`. The success screen promises exactly what the truthfulness
 * constraints in `docs/LEAD-ENGINE-PLAN.md` allow: the business gets an email. No SMS, no instant
 * quote, no confirmation number — none of those exist.
 */

import { useState } from 'react'

export default function LeadForm({ siteId }: { siteId: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  // The honeypot. Real visitors never see or reach this field — see the `.le-hp` rule in
  // SiteSections.tsx's SITE_CSS and `hp_field`'s own note in /api/lead-engine/submit.
  const [hpField, setHpField] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/lead-engine/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, name, phone, email, message, hp_field: hpField }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send that — try again in a moment.')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that — try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="le-form-success">
        <p className="le-eyebrow">Sent</p>
        <p className="le-p" style={{ color: 'var(--le-paper)' }}>
          Thanks — that&rsquo;s on its way to us now. We&rsquo;ll get back to you by email.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {error ? <p className="le-form-error">{error}</p> : null}

      {/* Honeypot — hidden off canvas, never `display:none` (some bots skip that check), never
          shown to a sighted or screen-reader visitor. tabIndex/aria-hidden keep it out of both. */}
      <div className="le-hp" aria-hidden="true">
        <label htmlFor="hp_field">Leave this field blank</label>
        <input
          id="hp_field" name="hp_field" type="text" tabIndex={-1} autoComplete="off"
          value={hpField} onChange={e => setHpField(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="le-field-label">Your name</div>
        <input
          className="le-field" type="text" required maxLength={100}
          value={name} onChange={e => setName(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div className="le-field-label">Phone</div>
        <input
          className="le-field" type="tel" maxLength={40}
          value={phone} onChange={e => setPhone(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div className="le-field-label">Email</div>
        <input
          className="le-field" type="email" required maxLength={200}
          value={email} onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div className="le-field-label">How can we help?</div>
        <textarea
          className="le-field" rows={4} maxLength={2000}
          value={message} onChange={e => setMessage(e.target.value)}
        />
      </div>

      <button type="submit" className="le-submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}

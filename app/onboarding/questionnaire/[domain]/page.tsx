'use client'

import { useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'

export default function QuestionnaireForm({ params }: { params: Promise<{ domain: string }> }) {
  const router = useRouter()
  // Next 15: params is a Promise; unwrap it in a client component with use().
  const { domain } = use(params)

  const [formData, setFormData] = useState({
    respondent_role: '',
    pain_point: '',
    service_types: '',
    avg_job_value: '$2,000–$5,000',
    has_emergency_service: false,
    emergency_contact: '',
    response_time: 'Same-day',
    common_objections: '',
    jargon: '',
    other_notes: '',
  })

  // Kept separate from formData: these do not belong to client_questionnaires. They drive the
  // times Ava is allowed to offer a caller, and are written to client_schedules instead.
  const [schedule, setSchedule] = useState(() => ({
    // Prefilled from the browser so most clients never touch it. Falls back to the same
    // default the server uses if the browser refuses to say.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
    open: '08:00',
    close: '17:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
    slot_duration_minutes: 60,
    max_concurrent_per_slot: 1,
  }))

  const toggleDay = (day: string) =>
    setSchedule(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day],
    }))

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/questionnaire/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_domain: domain,
          ...formData,
          // One open/close pair applied to the days that are ticked. Per-day hours are what
          // the column supports, but asking seven times is onboarding friction nobody needs
          // yet — the shape below is the full one, so split shifts drop in later.
          schedule: {
            timezone: schedule.timezone,
            business_hours: Object.fromEntries(
              ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [
                day,
                schedule.days.includes(day) ? { open: schedule.open, close: schedule.close } : null,
              ]),
            ),
            slot_duration_minutes: Number(schedule.slot_duration_minutes),
            max_concurrent_per_slot: Number(schedule.max_concurrent_per_slot),
          },
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save questionnaire')
      }

      setSubmitted(true)
      setTimeout(() => router.push('/client-dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#D4AF37' }}>
          Questionnaire Saved
        </h2>
        <p style={{ fontSize: '15px', color: '#94A3B8', marginBottom: '24px', lineHeight: '1.6' }}>
          Your questionnaire has been saved. Your agent is now live and will use this context to provide smarter responses.
        </p>
        <p style={{ fontSize: '13px', color: '#64748B' }}>Redirecting to dashboard...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 32px' }}>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: Inter, sans-serif; background: #0A0A0A; color: #FFFFFF; }
        input, textarea, select {
          background: #1A1A2E;
          border: 1px solid rgba(148,163,184,0.2);
          border-radius: 8px;
          padding: 10px 12px;
          color: #FFFFFF;
          font-size: 14px;
          font-family: Inter, sans-serif;
          margin-top: 6px;
          margin-bottom: 20px;
          width: 100%;
        }
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: #D4AF37;
          box-shadow: 0 0 0 2px rgba(212,175,55,0.1);
        }
        textarea {
          resize: vertical;
          min-height: 80px;
        }
        label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #CBD5E1;
          margin-bottom: 4px;
        }
        .section-label {
          font-size: 12px;
          font-family: monospace;
          color: #D4AF37;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-top: 32px;
          margin-bottom: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(148,163,184,0.15);
        }
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
        }
        input[type="checkbox"] {
          width: auto;
          margin: 0;
          cursor: pointer;
        }
        button {
          background: #D4AF37;
          color: #0A0A0A;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          margin-top: 32px;
          transition: opacity 0.2s;
        }
        button:hover { opacity: 0.9; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .error { color: #F87171; font-size: 13px; margin-bottom: 16px; }
      `}</style>

      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', color: '#FFFFFF' }}>
        Finish Your Setup
      </h1>
      <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '32px' }}>
        Help your AI agent understand your business. This takes ~5 minutes and makes responses smarter.
      </p>

      {error && <div className="error">❌ {error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="section-label">Section 1: About You</div>

        <label>Your Role</label>
        <input
          type="text"
          name="respondent_role"
          placeholder="e.g., Owner, Operations Manager"
          value={formData.respondent_role}
          onChange={handleChange}
        />

        <div className="section-label">Section 2: Your Service</div>

        <label>What's your main pain point right now?</label>
        <textarea
          name="pain_point"
          placeholder="e.g., We lose 3 jobs/week to missed calls"
          value={formData.pain_point}
          onChange={handleChange}
        />

        <label>What types of services/work do you offer?</label>
        <textarea
          name="service_types"
          placeholder="e.g., Residential roofing, commercial, storm damage restoration"
          value={formData.service_types}
          onChange={handleChange}
        />

        <label>Average job/contract value</label>
        <select name="avg_job_value" value={formData.avg_job_value} onChange={handleChange}>
          <option>$500–$2,000</option>
          <option>$2,000–$5,000</option>
          <option>$5,000–$10,000</option>
          <option>$10,000+</option>
        </select>

        <div className="section-label">Section 3: Operations</div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="emergency"
            name="has_emergency_service"
            checked={formData.has_emergency_service}
            onChange={handleChange}
          />
          <label htmlFor="emergency" style={{ margin: 0, marginTop: 0 }}>
            Do you handle emergency/after-hours calls?
          </label>
        </div>

        {formData.has_emergency_service && (
          <>
            <label style={{ marginTop: '16px' }}>Who should emergency calls go to?</label>
            <input
              type="text"
              name="emergency_contact"
              placeholder="e.g., Bob Johnson +1-555-0123"
              value={formData.emergency_contact}
              onChange={handleChange}
            />
          </>
        )}

        <label>What's your typical response time?</label>
        <select name="response_time" value={formData.response_time} onChange={handleChange}>
          <option>Same-day</option>
          <option>Next-day</option>
          <option>2–3 days</option>
          <option>Custom</option>
        </select>

        <div className="section-label">Section 4: When Can You Take Appointments?</div>
        <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '-8px', marginBottom: '20px', lineHeight: 1.6 }}>
          Your agent will only offer callers times inside these hours, and never offers a time
          that is already booked.
        </p>

        <label>Days you take appointments</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', marginBottom: '20px' }}>
          {[['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']].map(([key, label]) => {
            const on = schedule.days.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(key)}
                aria-pressed={on}
                style={{
                  width: 'auto', margin: 0, padding: '8px 14px', fontSize: '13px',
                  background: on ? '#D4AF37' : '#1A1A2E',
                  color: on ? '#0A0A0A' : '#CBD5E1',
                  border: `1px solid ${on ? '#D4AF37' : 'rgba(148,163,184,0.2)'}`,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label>Opens</label>
            <input
              type="time"
              value={schedule.open}
              onChange={e => setSchedule(p => ({ ...p, open: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Closes</label>
            <input
              type="time"
              value={schedule.close}
              onChange={e => setSchedule(p => ({ ...p, close: e.target.value }))}
            />
          </div>
        </div>

        <label>Your time zone</label>
        <select
          value={schedule.timezone}
          onChange={e => setSchedule(p => ({ ...p, timezone: e.target.value }))}
        >
          {/* Detected from the browser above; listed so it can be corrected. */}
          {Array.from(new Set([
            schedule.timezone,
            'America/New_York', 'America/Chicago', 'America/Denver',
            'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
          ])).map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
        </select>

        <label>How long does a typical appointment take?</label>
        <select
          value={schedule.slot_duration_minutes}
          onChange={e => setSchedule(p => ({ ...p, slot_duration_minutes: Number(e.target.value) }))}
        >
          <option value={30}>30 minutes</option>
          <option value={60}>1 hour</option>
          <option value={90}>1.5 hours</option>
          <option value={120}>2 hours</option>
          <option value={240}>Half a day</option>
        </select>

        <label>How many appointments can you run at the same time?</label>
        <input
          type="number"
          min={1}
          max={50}
          value={schedule.max_concurrent_per_slot}
          onChange={e => setSchedule(p => ({ ...p, max_concurrent_per_slot: Number(e.target.value) }))}
        />
        <p style={{ fontSize: '12px', color: '#64748B', marginTop: '-14px', marginBottom: '20px' }}>
          One truck or one crew? Leave this at 1. Three crews that can be out at once? Set it to 3.
        </p>

        <div className="section-label">Section 5: Help Us Sound Like You</div>

        <label>What objections do callers raise most?</label>
        <textarea
          name="common_objections"
          placeholder="e.g., Price too high, timeline too long, wants guarantee"
          value={formData.common_objections}
          onChange={handleChange}
        />

        <label>Any specific jargon or terminology we should know?</label>
        <textarea
          name="jargon"
          placeholder="e.g., We say 'hail claim' not 'storm damage'; '3-tab vs architectural shingles'"
          value={formData.jargon}
          onChange={handleChange}
        />

        <label>Anything else we should know about your business?</label>
        <textarea
          name="other_notes"
          placeholder="Free-form notes..."
          value={formData.other_notes}
          onChange={handleChange}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save & Activate Agent'}
        </button>
      </form>
    </div>
  )
}

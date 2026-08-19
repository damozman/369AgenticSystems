'use client'

import { useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { deriveItemKey, describeChoices, matchItem } from '@/lib/inventory'

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
    // Never asked before, so every client silently kept the database defaults of 14 days
    // and 12 hours. Fine for a trade booking this week; wrong for anyone booking events
    // months out, and invisible — they tick Saturday, see it saved, and still get refused.
    booking_horizon_days: 60,
    lead_time_hours: 12,
  }))

  // Rental stock. Off by default: most verticals sell time, and an equipment table is pure
  // friction for a roofer. Mirrors the has_emergency_service pattern in Section 3.
  const [rentsItems, setRentsItems] = useState(false)

  /**
   * quantity is held as TEXT, not a number.
   *
   * Coercing on every keystroke means clearing the box yields Number('') === 0, so a 0 sits
   * in the field and whatever is typed next lands after it — typing 10 gives 010. Keeping the
   * raw text lets the box be genuinely empty mid-edit; it is parsed once, on submit.
   */
  type ItemRow = { label: string; quantity: string }
  const [inventory, setInventory] = useState<ItemRow[]>([{ label: '', quantity: '1' }])

  const setItem = (i: number, patch: Partial<ItemRow>) =>
    setInventory(prev => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const addItem    = () => setInventory(prev => [...prev, { label: '', quantity: '1' }])
  const removeItem = (i: number) => setInventory(prev => prev.filter((_, idx) => idx !== i))

  /** Digits only while typing, and an empty box is allowed until they leave the field. */
  const onQuantityChange = (i: number, raw: string) =>
    setItem(i, { quantity: raw.replace(/[^0-9]/g, '').slice(0, 4) })

  /** On the way out, settle it: empty or 0 becomes 1, and 007 becomes 7. */
  const onQuantityBlur = (i: number) =>
    setItem(i, { quantity: String(Math.max(1, parseInt(inventory[i]?.quantity ?? '1', 10) || 1)) })

  const quantityOf = (row: ItemRow) => Math.max(1, parseInt(row.quantity, 10) || 1)

  const filledItems = inventory.filter(r => r.label.trim() !== '')

  /**
   * Which names would leave Ava unable to tell two items apart.
   *
   * Runs the SAME matcher the booking route runs, so this is not an approximation of the
   * problem — it is the problem. A collision is not an error and must never block signup:
   * Ava simply has to ask 'which one?' every time a caller uses that word. Renaming now is
   * free, and discovering it on a live booking call is not.
   */
  const collisions = (() => {
    const pool = filledItems.map(r => ({
      item_key: deriveItemKey(r.label), label: r.label.trim(), quantity: quantityOf(r),
    }))
    const words = new Set<string>()
    for (const it of pool) for (const w of it.label.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length > 2) words.add(w)
    }
    const out: string[] = []
    for (const w of words) {
      const m = matchItem(pool, w)
      if (m.kind === 'ambiguous') out.push(`"${w}" could mean ${describeChoices(m.candidates)}`)
    }
    return out
  })()

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
          // Proof that this form was opened from a link we sent. Read from the URL at submit
          // time rather than via useSearchParams, which would drag a Suspense boundary into a
          // page that has no other reason for one.
          onboarding_token: new URLSearchParams(window.location.search).get('t'),
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
            booking_horizon_days: Number(schedule.booking_horizon_days),
            lead_time_hours: Number(schedule.lead_time_hours),
          },
          // Only when they said they rent things. An empty array and an absent key mean
          // different things to the route: absent leaves existing stock alone.
          ...(rentsItems ? { inventory: filledItems.map(r => ({ label: r.label.trim(), quantity: quantityOf(r) })) } : {}),
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

        <label>How far ahead can people book?</label>
        <select
          value={schedule.booking_horizon_days}
          onChange={e => setSchedule(p => ({ ...p, booking_horizon_days: Number(e.target.value) }))}
        >
          <option value={14}>2 weeks</option>
          <option value={30}>1 month</option>
          <option value={60}>2 months</option>
          <option value={120}>4 months</option>
          <option value={180}>6 months</option>
          <option value={365}>1 year</option>
        </select>
        <p style={{ fontSize: '12px', color: '#64748B', marginTop: '-14px', marginBottom: '20px' }}>
          Your agent refuses anything past this. Booking parties or events months out? Pick 6 months or a year.
        </p>

        <label>How much notice do you need before a job?</label>
        <select
          value={schedule.lead_time_hours}
          onChange={e => setSchedule(p => ({ ...p, lead_time_hours: Number(e.target.value) }))}
        >
          <option value={0}>None — same hour is fine</option>
          <option value={2}>2 hours</option>
          <option value={12}>12 hours</option>
          <option value={24}>1 day</option>
          <option value={48}>2 days</option>
          <option value={72}>3 days</option>
        </select>
        <p style={{ fontSize: '12px', color: '#64748B', marginTop: '-14px', marginBottom: '20px' }}>
          Nothing sooner than this gets offered. If you have to load a truck the day before, say 2 days.
        </p>

        <div className="section-label">Section 5: Do You Rent Out Equipment?</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <input
            type="checkbox"
            id="rentsItems"
            checked={rentsItems}
            onChange={e => setRentsItems(e.target.checked)}
            style={{ width: 'auto', margin: 0 }}
          />
          <label htmlFor="rentsItems" style={{ margin: 0, marginTop: 0 }}>
            Yes — we rent out specific items (bounce houses, tables, equipment)
          </label>
        </div>
        <p style={{ fontSize: '12px', color: '#64748B', marginTop: '-14px', marginBottom: '20px' }}>
          Leave this unticked if you sell your time rather than things. Tick it and your agent
          tracks each item separately, so one castle out on Saturday does not block the rest.
        </p>

        {rentsItems && (
          <>
            <label>Your items</label>
            <div style={{ marginTop: '6px', marginBottom: '12px' }}>
              {inventory.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input
                    style={{ flex: 3, margin: 0 }}
                    placeholder="e.g., Princess Castle bounce house"
                    value={row.label}
                    onChange={e => setItem(i, { label: e.target.value })}
                  />
                  <input
                    style={{ flex: 1, margin: 0, minWidth: 0 }}
                    // text + inputMode, not type=number: a number input keeps its own
                    // partially-typed buffer, which is what put a stray 0 in front of the
                    // digits. inputMode still brings up the numeric keypad on a phone.
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="How many you own"
                    value={row.quantity}
                    onChange={e => onQuantityChange(i, e.target.value)}
                    onBlur={() => onQuantityBlur(i)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    aria-label={`Remove ${row.label || 'item'}`}
                    disabled={inventory.length === 1}
                    style={{
                      width: 'auto', margin: 0, padding: '10px 14px', fontSize: '13px',
                      background: '#1A1A2E', color: '#94A3B8',
                      border: '1px solid rgba(148,163,184,0.2)',
                      opacity: inventory.length === 1 ? 0.4 : 1,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              style={{
                width: 'auto', margin: '0 0 8px', padding: '10px 18px', fontSize: '13px',
                background: '#1A1A2E', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.4)',
              }}
            >
              + Add another item
            </button>

            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '-14px', marginBottom: '20px' }}>
              The number is how many you own. Two identical bounce houses? One row, quantity 2.
              Got a lot of stock? Send us a spreadsheet instead and we will load it for you.
            </p>

            {collisions.length > 0 && (
              /* Not an error. Ava can still book these — she just has to ask which one every
                 time a caller says the shared word, and renaming now costs nothing. */
              <div style={{
                border: '1px solid rgba(212,175,55,0.4)', background: 'rgba(212,175,55,0.06)',
                borderRadius: '8px', padding: '12px 14px', marginBottom: '20px',
              }}>
                <div style={{ fontSize: '13px', color: '#D4AF37', fontWeight: 700, marginBottom: '6px' }}>
                  Some names sound alike
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#94A3B8', lineHeight: 1.7 }}>
                  {collisions.map(c => <li key={c}>{c}</li>)}
                </ul>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '8px', lineHeight: 1.6 }}>
                  That is fine — your agent will ask the caller which one they mean. Give them more
                  distinct names if you would rather she did not have to.
                </div>
              </div>
            )}
          </>
        )}

        <div className="section-label">Section 6: Help Us Sound Like You</div>

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

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function QuestionnaireForm({ params }: { params: { domain: string } }) {
  const router = useRouter()
  const { domain } = params

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

        <div className="section-label">Section 4: Help Us Sound Like You</div>

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

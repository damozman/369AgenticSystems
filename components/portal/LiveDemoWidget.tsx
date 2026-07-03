'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface DemoCall {
  call_id:          string
  caller_phone:     string
  call_outcome:     string | null
  duration_seconds: number | null
  created_at:       string
}

interface Props {
  demoPhone: string
}

export function LiveDemoWidget({ demoPhone }: Props) {
  const [calls, setCalls]               = useState<DemoCall[]>([])
  const [justCaptured, setJustCaptured] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchCalls() {
      const { data } = await supabase
        .from('calls')
        .select('call_id, caller_phone, call_outcome, duration_seconds, created_at')
        .order('created_at', { ascending: false })
        .limit(3)
      if (mounted && data) setCalls(data)
    }

    fetchCalls()

    const channel = supabase
      .channel('live-demo-calls')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls' },
        (payload) => {
          if (!mounted) return
          setCalls(prev => [payload.new as DemoCall, ...prev.slice(0, 2)])
          setJustCaptured(true)
          setTimeout(() => setJustCaptured(false), 4000)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls' },
        (payload) => {
          if (!mounted) return
          const updated = payload.new as DemoCall
          setCalls(prev => prev.map(c =>
            c.call_id === updated.call_id ? updated : c
          ))
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const outcomeColor = (o: string | null) => {
    switch ((o ?? '').toLowerCase()) {
      case 'booked':         return { text: '#4ADE80', bg: 'rgba(74,222,128,0.12)' }
      case 'captured_lead':  return { text: '#60A5FA', bg: 'rgba(96,165,250,0.12)' }
      case 'in_progress':    return { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)' }
      case 'spam':           return { text: '#94A3B8', bg: 'rgba(148,163,184,0.10)' }
      default:               return { text: '#94A3B8', bg: 'rgba(148,163,184,0.10)' }
    }
  }

  const outcomeLabel = (o: string | null) => {
    switch ((o ?? '').toLowerCase()) {
      case 'booked':         return 'BOOKED'
      case 'captured_lead':  return 'LEAD CAPTURED'
      case 'in_progress':    return 'LIVE'
      case 'no_answer':      return 'NO ANSWER'
      case 'spam':           return 'SPAM'
      default:               return (o ?? 'UNKNOWN').toUpperCase()
    }
  }

  const formatDuration = (s: number | null) => {
    if (!s) return null
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  const maskPhone = (p: string) => {
    if (!p || p === 'unknown') return 'Unknown caller'
    const digits = p.replace(/\D/g, '')
    if (digits.length === 11) return `(${digits.slice(1,4)}) ***-${digits.slice(-4)}`
    if (digits.length === 10) return `(${digits.slice(0,3)}) ***-${digits.slice(-4)}`
    return p
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.035)',
      border: '1px solid rgba(212,175,55,0.2)',
      borderRadius: 16,
      padding: '32px 28px',
      marginBottom: 40,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#D4AF37',
          letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          // LIVE DEMO
        </p>
        <h2 style={{ fontFamily: 'Instrument Sans, sans-serif', fontSize: 22,
          fontWeight: 600, color: '#F0F0F0', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Hear It Work. Right Now.
        </h2>
        <p style={{ color: '#94A3B8', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Call this number. Say you need a roof inspection.<br />
          Watch what happens below.
        </p>
      </div>

      {/* Phone CTA */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <a
          href={`tel:${demoPhone.replace(/\D/g, '')}`}
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #D4AF37 0%, #B8960C 100%)',
            color: '#0A0A0A',
            fontFamily: 'Instrument Sans, sans-serif',
            fontSize: 24,
            fontWeight: 700,
            padding: '14px 32px',
            borderRadius: 10,
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          📞 {demoPhone}
        </a>
        <p style={{ color: '#64748B', fontSize: 11, marginTop: 8, fontFamily: 'Courier New, monospace' }}>
          Tap to call on mobile · Dial manually on desktop
        </p>
      </div>

      {/* Live feed */}
      <div style={{
        background: justCaptured ? 'rgba(74,222,128,0.06)' : 'rgba(0,0,0,0.3)',
        border: `1px solid ${justCaptured ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
        padding: '16px 18px',
        transition: 'all 0.5s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10,
            color: '#94A3B8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Live Call Feed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'Courier New, monospace', fontSize: 10, color: '#4ADE80' }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#4ADE80',
              display: 'inline-block',
            }} />
            Watching for calls
          </span>
        </div>

        {justCaptured && (
          <div style={{
            background: 'rgba(74,222,128,0.1)',
            border: '1px solid rgba(74,222,128,0.25)',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 12,
            fontFamily: 'Courier New, monospace',
            fontSize: 12,
            color: '#4ADE80',
            textAlign: 'center',
          }}>
            ✓ New call captured!
          </div>
        )}

        {calls.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 13, textAlign: 'center',
            padding: '16px 0', margin: 0, fontFamily: 'Courier New, monospace' }}>
            Call the number above — it appears here within seconds.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {calls.map((call, i) => {
              const oc  = outcomeColor(call.call_outcome)
              const dur = formatDuration(call.duration_seconds)
              return (
                <div
                  key={call.call_id}
                  style={{
                    background: i === 0 && justCaptured
                      ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${i === 0 && justCaptured
                      ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ color: '#F0F0F0', fontSize: 13, fontWeight: 600,
                      fontFamily: 'Courier New, monospace' }}>
                      {maskPhone(call.caller_phone)}
                    </span>
                    <span style={{
                      fontFamily: 'Courier New, monospace', fontSize: 9,
                      color: oc.text, background: oc.bg,
                      padding: '2px 7px', borderRadius: 4,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      {outcomeLabel(call.call_outcome)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <p style={{ color: '#475569', fontSize: 11, margin: 0,
                      fontFamily: 'Courier New, monospace' }}>
                      {new Date(call.created_at).toLocaleTimeString()}
                    </p>
                    {dur && (
                      <p style={{ color: '#475569', fontSize: 11, margin: 0,
                        fontFamily: 'Courier New, monospace' }}>
                        · {dur}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p style={{ color: '#334155', fontSize: 11, textAlign: 'center',
        margin: '12px 0 0', fontFamily: 'Courier New, monospace' }}>
        This is a live system. Real calls. Real-time.
      </p>
    </div>
  )
}

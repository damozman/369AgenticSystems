'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type ToastCall = {
  call_id:      string
  caller_phone: string
  call_outcome: string | null
}

const LABELS: Record<string, string> = {
  booked:        'Appointment Booked',
  captured_lead: 'Lead Captured',
  in_progress:   'Live Call',
  no_answer:     'No Answer',
  spam:          'Spam',
}

function maskPhone(p: string) {
  const d = p.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(1,4)}) ***-${d.slice(-4)}`
  if (d.length === 10) return `(${d.slice(0,3)}) ***-${d.slice(-4)}`
  return p
}

export function LiveCallToast({ clientDomain }: { clientDomain: string }) {
  const [toast, setToast]   = useState<ToastCall | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    let timer: ReturnType<typeof setTimeout>

    const channel = supabase
      .channel(`toast-${clientDomain}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `client_domain=eq.${clientDomain}` },
        (payload) => {
          if (!mounted) return
          clearTimeout(timer)
          setToast(payload.new as ToastCall)
          setVisible(true)
          timer = setTimeout(() => setVisible(false), 5500)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [clientDomain])

  if (!toast) return null

  const label = LABELS[toast.call_outcome ?? ''] ?? (toast.call_outcome ?? 'Unknown')
  const isGood = toast.call_outcome === 'booked' || toast.call_outcome === 'captured_lead'

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 transition-all duration-300"
      style={{
        transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        opacity:       visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold whitespace-nowrap"
        style={{
          background:   isGood ? 'rgba(5,120,80,0.97)'  : 'rgba(20,20,20,0.97)',
          borderColor:  isGood ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.1)',
          color:        '#FFFFFF',
          backdropFilter: 'blur(14px)',
        }}
      >
        <span style={{ fontSize: 16 }}>📞</span>
        <span>{maskPhone(toast.caller_phone)}</span>
        <span
          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }}
        >
          {label}
        </span>
        <button
          onClick={() => setVisible(false)}
          className="ml-1 opacity-60 hover:opacity-100 transition-opacity text-base leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}

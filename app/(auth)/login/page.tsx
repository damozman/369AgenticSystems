'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin'

type Stage = 'email' | 'code'

export default function LoginPage() {
  const [email, setEmail]   = useState('')
  const [otp, setOtp]       = useState('')
  const [stage, setStage]   = useState<Stage>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Stable singleton — re-creating on every render can race with stored PKCE state
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // No emailRedirectTo — Supabase sends an 8-digit code in the email body.
    // Avoids PKCE magic-link flow which breaks when the link is opened in a
    // different browser or email client's built-in WebView.
    const { error } = await supabase.auth.signInWithOtp({ email })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setStage('code')
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: 'email',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // createBrowserClient has already synced the session to cookies;
    // refresh so Next.js server components re-run with the new session.
    router.refresh()
    router.push(isAdminEmail(email) ? '/dashboard' : '/client-dashboard')
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="inline-flex items-baseline gap-2.5 mb-1.5">
          <span className="text-3xl font-display font-bold text-[#D4AF37]">369</span>
          <span className="text-sm font-display text-slate-400 uppercase tracking-[0.25em]">
            Agentic Systems
          </span>
        </div>
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.3em]">
          Client Command Center
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#111111] p-8"
      >
        {/* Scan line */}
        <motion.div
          className="absolute inset-x-0 h-[1px] pointer-events-none z-10"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)',
          }}
          initial={{ top: 0 }}
          animate={{ top: '100%' }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 5, ease: 'linear' }}
        />

        {stage === 'email' ? (
          <>
            <div className="mb-6">
              <p className="text-[#D4AF37] font-mono text-[10px] tracking-[0.2em] uppercase mb-1.5">
                [SECURE ACCESS]
              </p>
              <h1 className="text-xl font-display font-semibold text-white">
                Enter Command Center
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                A one-time access code will be sent to your registered email.
              </p>
            </div>

            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-[10px] font-mono text-slate-500 uppercase tracking-[0.15em] mb-2"
                >
                  Client Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@yourcompany.com"
                  className="w-full bg-[#0D0D0D] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-sm font-mono text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-[rgba(212,175,55,0.45)] transition-colors"
                />
              </div>

              {error && (
                <p className="text-red-400 font-mono text-xs">[ERROR] {error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-sm text-[#0D0D0D] bg-[#D4AF37] hover:bg-[#F0C94A] disabled:opacity-40 transition-all duration-200"
              >
                {loading
                  ? <span className="font-mono text-xs">[TRANSMITTING...]</span>
                  : 'Request Secure Access'
                }
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-[#D4AF37] font-mono text-[10px] tracking-[0.2em] uppercase mb-1.5">
                [UPLINK ESTABLISHED]
              </p>
              <h1 className="text-xl font-display font-semibold text-white">
                Enter Access Code
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                A 6-digit code was dispatched to{' '}
                <span className="text-[#D4AF37]">{email}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label
                  htmlFor="otp"
                  className="block text-[10px] font-mono text-slate-500 uppercase tracking-[0.15em] mb-2"
                >
                  Access Code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  placeholder="000000"
                  className="w-full bg-[#0D0D0D] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-3 text-2xl font-mono text-center text-slate-200 placeholder:text-slate-700 tracking-[0.5em] focus:outline-none focus:border-[rgba(212,175,55,0.45)] transition-colors"
                />
              </div>

              {error && (
                <p className="text-red-400 font-mono text-xs">[ERROR] {error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 8}
                className="w-full py-3 rounded-lg font-semibold text-sm text-[#0D0D0D] bg-[#D4AF37] hover:bg-[#F0C94A] disabled:opacity-40 transition-all duration-200"
              >
                {loading
                  ? <span className="font-mono text-xs">[AUTHENTICATING...]</span>
                  : 'Authenticate'
                }
              </button>

              <button
                type="button"
                onClick={() => { setStage('email'); setOtp(''); setError(null) }}
                className="w-full text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors py-1"
              >
                ← use a different email
              </button>
            </form>

            <div className="mt-5 space-y-1 text-xs font-mono text-slate-600">
              <p><span className="text-[#D4AF37]">›</span> Code expires in 60 minutes</p>
              <p><span className="text-[#D4AF37]">›</span> Single-use authentication</p>
              <p>
                <span className="text-[#D4AF37]">›</span>{' '}
                <span className="animate-terminal-blink">_</span>
              </p>
            </div>
          </>
        )}
      </motion.div>

      <p className="text-center text-[10px] font-mono text-slate-700 mt-6">
        369 Agentic Systems · Encrypted Portal Access
      </p>
    </div>
  )
}

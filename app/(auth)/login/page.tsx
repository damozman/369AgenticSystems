'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
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

        {!submitted ? (
          <>
            <div className="mb-6">
              <p className="text-[#D4AF37] font-mono text-[10px] tracking-[0.2em] uppercase mb-1.5">
                [SECURE ACCESS]
              </p>
              <h1 className="text-xl font-display font-semibold text-white">
                Enter Command Center
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                A magic link will be sent to your registered email.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
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
          <div className="text-center py-4">
            <p className="text-[#D4AF37] font-mono text-[10px] tracking-[0.2em] uppercase mb-4">
              [UPLINK ESTABLISHED]
            </p>
            <p className="text-white font-semibold mb-2">Check your inbox</p>
            <p className="text-sm text-slate-400">
              A secure link has been dispatched to{' '}
              <span className="text-[#D4AF37]">{email}</span>
            </p>
            <div className="mt-5 space-y-1 text-xs font-mono text-slate-600">
              <p><span className="text-[#D4AF37]">›</span> Expires in 60 minutes</p>
              <p><span className="text-[#D4AF37]">›</span> Single-use authenticated link</p>
              <p>
                <span className="text-[#D4AF37]">›</span>{' '}
                <span className="animate-terminal-blink">_</span>
              </p>
            </div>
          </div>
        )}
      </motion.div>

      <p className="text-center text-[10px] font-mono text-slate-700 mt-6">
        369 Agentic Systems · Encrypted Portal Access
      </p>
    </div>
  )
}

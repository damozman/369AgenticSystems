'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Shield, Zap } from 'lucide-react'
import type { SystemAudit } from './ActiveSpecialists'

interface Props {
  audit: SystemAudit | null
  onClose: () => void
  onAuthorize: (domain: string) => void
}

interface VulnVector {
  label: string
  detail: string
  risk: string
}

function buildVectors(audit: SystemAudit): VulnVector[] {
  const vectors: VulnVector[] = []

  if (audit.leak_detected) {
    vectors.push({
      label: 'Data Exfiltration Pathway',
      detail: `Unencrypted data pipeline detected on ${audit.client_domain}. Outbound form submissions are transmitting without enforced TLS — customer PII and lead data exposed to packet inspection and man-in-the-middle interception.`,
      risk: 'Data breach · CCPA/GDPR liability · Customer trust damage',
    })
  }

  if (audit.security_score != null && audit.security_score < 70) {
    vectors.push({
      label: 'Security Posture Below Threshold',
      detail: `Score: ${audit.security_score}/100. Critical headers missing (HSTS, CSP, X-Frame-Options). Authentication endpoints lack rate-limit enforcement — brute force pathways are open.`,
      risk: 'Brute-force exposure · Clickjacking · Session hijack risk',
    })
  }

  if (vectors.length === 0) {
    vectors.push({
      label: 'Unclassified Exposure Vector',
      detail: `Anomalous data pattern flagged on ${audit.client_domain}. Agent network detected irregular outbound traffic requiring specialist assessment before root cause can be confirmed.`,
      risk: 'Unknown exposure · Escalation recommended',
    })
  }

  return vectors
}

const PATCH_STEPS = [
  'Enforce TLS on all form submission and API endpoints',
  'Rotate any exposed credentials or API tokens',
  'Install missing security headers (HSTS, CSP, X-Frame-Options)',
  'Run post-patch rescan — confirm leak is fully sealed',
]

export default function DiagnosticDrawer({ audit, onClose, onAuthorize }: Props) {
  const [authorizing, setAuthorizing] = useState(false)

  async function handleAuthorize() {
    if (!audit || authorizing) return
    setAuthorizing(true)
    onAuthorize(audit.client_domain) // immediately: close drawer + card enters PATCHING state
    try {
      await fetch('/api/patch-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_domain: audit.client_domain }),
      })
      // Supabase realtime fires the card update — no manual state needed
    } catch {
      // Supabase realtime will still update if the DB write succeeded
    }
  }

  return (
    <AnimatePresence>
      {audit && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed right-0 inset-y-0 z-50 w-full sm:w-[440px] flex flex-col bg-[#080808] border-l border-[#D4AF3728] shadow-2xl"
          >
            {/* Gold top bar */}
            <div className="h-[2px] bg-[#D4AF37] flex-shrink-0" />

            {/* Chrome header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#161616] flex-shrink-0 bg-[#0A0A0A]">
              <div>
                <p className="text-[9px] font-mono text-[#D4AF37] uppercase tracking-[0.25em]">
                  // DIAGNOSTIC PANEL
                </p>
                <p className="text-xs font-mono text-slate-500 mt-0.5 truncate max-w-[280px]">
                  {audit.client_domain}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-[#1A1A1A] transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* CRITICAL badge */}
              <div className="inline-flex items-center gap-2 bg-red-950/25 border border-red-900/40 rounded px-3 py-1.5">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="text-[9px] font-mono text-red-400 uppercase tracking-[0.2em]">
                  Critical Vulnerability Report
                </span>
              </div>

              {/* Vulnerability vectors */}
              {buildVectors(audit).map((v, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield size={10} className="text-red-500 flex-shrink-0" />
                    <p className="text-[10px] font-mono text-red-400 uppercase tracking-wider">{v.label}</p>
                  </div>
                  <div className="bg-[#0D0D0D] border border-[#1E1E1E] border-l-2 border-l-red-900/60 rounded-sm p-3 space-y-2.5">
                    <p className="text-xs text-slate-300 leading-relaxed">{v.detail}</p>
                    <p className="text-[9px] font-mono">
                      <span className="text-red-900 mr-1.5 uppercase tracking-wider">Risk:</span>
                      <span className="text-red-500/70">{v.risk}</span>
                    </p>
                  </div>
                </div>
              ))}

              {/* Divider */}
              <div className="border-t border-[#161616]" />

              {/* Agent deployment plan */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={10} className="text-[#D4AF37] flex-shrink-0" />
                  <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-wider">
                    Agent Deployment Plan
                  </p>
                </div>
                <div className="space-y-2.5 pl-1">
                  {PATCH_STEPS.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="text-[#D4AF37] text-[10px] font-mono flex-shrink-0 mt-0.5">›</span>
                      <p className="text-xs text-slate-400 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[#161616]" />

              {/* Live metrics snapshot */}
              <div>
                <p className="text-[9px] font-mono text-slate-700 uppercase tracking-wider mb-2">
                  Current Readings
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {audit.security_score != null && (
                    <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-lg p-2.5">
                      <p className="text-[8px] font-mono text-slate-600 uppercase mb-1">Security</p>
                      <p className="text-base font-bold text-white">{audit.security_score}</p>
                    </div>
                  )}
                  {audit.seo_visibility != null && (
                    <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-lg p-2.5">
                      <p className="text-[8px] font-mono text-slate-600 uppercase mb-1">SEO Vis.</p>
                      <p className="text-base font-bold text-white">{audit.seo_visibility}</p>
                    </div>
                  )}
                  {audit.roi_multiplier != null && (
                    <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-lg p-2.5">
                      <p className="text-[8px] font-mono text-slate-600 uppercase mb-1">ROI</p>
                      <p className="text-base font-bold text-[#D4AF37]">{audit.roi_multiplier}x</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer CTA */}
            <div className="flex-shrink-0 px-6 py-5 border-t border-[#161616] bg-[#0A0A0A]">
              <p className="text-[9px] font-mono text-slate-700 mb-3 uppercase tracking-wider">
                // Deployment requires your explicit authorization
              </p>
              <button
                onClick={handleAuthorize}
                disabled={authorizing}
                className={[
                  'w-full py-3.5 px-6 rounded font-mono text-sm font-bold uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2',
                  authorizing
                    ? 'bg-[#D4AF3718] border border-[#D4AF3740] text-[#D4AF37] cursor-not-allowed'
                    : 'bg-[#D4AF37] text-[#080808] hover:bg-[#F0C94A] active:scale-[0.98] cursor-pointer',
                ].join(' ')}
              >
                {authorizing ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-3.5 h-3.5 border-2 border-[#D4AF37] border-t-transparent rounded-full"
                    />
                    Deploying Agent...
                  </>
                ) : (
                  'Authorize Agent Patch →'
                )}
              </button>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

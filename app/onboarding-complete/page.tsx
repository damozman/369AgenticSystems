import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { STRIPE_CUSTOM_FIELD_KEYS, customFieldValue } from '@/lib/stripe-config'
import { questionnaireUrl } from '@/lib/security/onboarding-token'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SessionInfo {
  businessName?: string
  clientDomain?: string
  email?: string
}

// Reads straight off the Stripe session rather than waiting on our own webhook —
// Stripe redirects the browser here the instant checkout completes, with no
// guaranteed ordering against checkout.session.completed reaching our webhook
// and finishing provisioning. The session itself has businessName/clientDomain
// immediately (they're checkout custom fields), so this never has to block on
// or guess about provisioning timing.
async function getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null
  try {
    const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return {
      businessName: customFieldValue(session.custom_fields, STRIPE_CUSTOM_FIELD_KEYS.businessName),
      clientDomain: customFieldValue(session.custom_fields, STRIPE_CUSTOM_FIELD_KEYS.clientDomain),
      email:        session.customer_details?.email ?? undefined,
    }
  } catch (e) {
    console.error('[ONBOARDING-COMPLETE] Failed to retrieve Stripe session:', e)
    return null
  }
}

// Best-effort only — provisioning may genuinely not have finished yet by the
// time this page renders, and that's fine, the page just omits the number.
async function getPhoneNumber(clientDomain: string): Promise<string | null> {
  const { data } = await supabase
    .from('agent_subscriptions')
    .select('retell_phone_number')
    .eq('client_domain', clientDomain)
    .maybeSingle()
  return data?.retell_phone_number ?? null
}

export default async function OnboardingCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  // Next 15: searchParams is a Promise and must be awaited.
  const { session_id } = await searchParams
  const info  = session_id ? await getSessionInfo(session_id) : null
  const phone = info?.clientDomain ? await getPhoneNumber(info.clientDomain) : null

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-baseline gap-2.5 mb-1.5">
            <span className="text-3xl font-display font-bold text-[#D4AF37]">369</span>
            <span className="text-sm font-display text-[#94a3b8] uppercase tracking-[0.25em]">
              Agentic Systems
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#111111] p-8">
          <p className="text-[#D4AF37] font-mono text-[10px] tracking-[0.2em] uppercase mb-1.5">
            [PAYMENT CONFIRMED]
          </p>
          <h1 className="text-2xl font-display font-semibold text-white mb-2">
            {info?.businessName ? `You're all set, ${info.businessName}` : "You're all set"}
          </h1>
          <p className="text-sm text-[#94a3b8] mb-6">
            {info?.email
              ? <>We've also sent the full details to <span className="text-[#CBD5E1]">{info.email}</span>.</>
              : "We've sent the full details to your email."}
          </p>

          {phone ? (
            <div className="rounded-xl border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.1)] px-5 py-4 mb-6">
              <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.15em] mb-1.5">
                Your Dedicated Phone Number
              </p>
              <p className="text-lg font-bold text-white font-mono tracking-wide">{phone}</p>
              <p className="text-xs text-[#94A3B8] mt-2">This number is already live and answering calls 24/7.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-5 py-4 mb-6">
              <p className="text-sm text-[#94A3B8]">
                Your dedicated phone number is being provisioned right now — it'll be in your email within a few minutes.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] px-6 py-6 text-center mb-2">
            <p className="text-sm text-white mb-4">
              <strong>Fast-track your setup:</strong> answer a quick questionnaire so your agent understands your business.
            </p>
            {info?.clientDomain ? (
              <a
                href={questionnaireUrl(info.clientDomain, '')}
                className="inline-block rounded-lg bg-[#D4AF37] px-7 py-3 text-sm font-bold text-[#0A0A0A] no-underline"
              >
                Complete Questionnaire (5 min)
              </a>
            ) : (
              <a
                href="/login"
                className="inline-block rounded-lg bg-[#D4AF37] px-7 py-3 text-sm font-bold text-[#0A0A0A] no-underline"
              >
                Access your dashboard
              </a>
            )}
            <p className="text-xs text-[#64748B] mt-3">
              Prefer to explore first? <a href="/login" className="text-[#D4AF37]">Access your dashboard</a> anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

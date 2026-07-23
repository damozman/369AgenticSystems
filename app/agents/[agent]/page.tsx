import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { DeploymentCards } from './DeploymentCards'

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentSlug = 'ava' | 'rex' | 'nova' | 'felix' | 'scout'
type AgentStatus = 'live' | 'deploying'

interface VerticalDeployment {
  vertical: string
  label: string
  role: string
  what: string
  color: string
  slug: string
}

interface AgentData {
  slug:        AgentSlug
  name:        string
  role:        string
  status:      AgentStatus
  tagline:     string
  description: string
  color:       string
  how:         { step: string; detail: string }[]
  deployments: VerticalDeployment[]
  tech:        string[]
}

// ── Agent Content ─────────────────────────────────────────────────────────────

const AGENTS: Record<AgentSlug, AgentData> = {
  ava: {
    slug:    'ava',
    name:    'Ava',
    role:    'AI Receptionist',
    status:  'live',
    color:   '#D4AF37',
    tagline: 'Answers 24/7, knows your business. Every call becomes a qualified lead.',
    description: 'Ava is a fully autonomous AI receptionist deployed on a real phone number. She answers every inbound call in under 60 seconds — nights, weekends, holidays — qualifies the caller using a system prompt tuned for your industry, captures their contact information, and either books an appointment directly on your calendar or routes the call to the right person. Before her first call, she learns your business from a 5-minute questionnaire: your pain points, services offered, pricing, and common objections. She uses this context on every single call. Your unique phone number is allocated and live within minutes of signup.',
    how: [
      { step: 'Your business context captured',     detail: 'Before Ava takes her first call, you answer a 5-minute questionnaire: pain points, services, pricing, jargon, common objections. She learns your business — not a generic AI.' },
      { step: 'Inbound call arrives',     detail: 'Your business number rings. Ava answers within 2–3 rings, 24 hours a day, 365 days a year. There is no voicemail.' },
      { step: 'Caller qualified',          detail: 'Ava identifies the nature of the call using a system prompt tuned for your vertical — storm damage vs. new roof, emergency vs. scheduled service, statute of limitations urgency. She uses the language of your industry.' },
      { step: 'Lead data captured',        detail: 'Caller name, phone number, address, issue description, and urgency are extracted and written to your dashboard in real time. You see the lead the moment the call ends.' },
      { step: 'Booking or escalation',     detail: 'If the caller is ready to schedule, Ava books directly on your Cal.com calendar and sends a confirmation. If it\'s an emergency, she escalates to your on-call team immediately.' },
    ],
    deployments: [
      { vertical: 'Roofing',      label: 'Roofing',      role: 'Storm Call Capture',      what: 'Knows storm seasons, insurance claim language, and cash buyer vs. adjuster. Unique phone allocated in minutes. Monthly ROI email included.', color: '#FF4500', slug: 'roofing'      },
      { vertical: 'HVAC',         label: 'HVAC',         role: 'Emergency Response',      what: 'Understands emergency vs. maintenance triage. Knows HVAC terminology and pricing. Live in minutes with business context.', color: '#FF6533', slug: 'hvac'         },
      { vertical: 'Plumbing',     label: 'Plumbing',     role: 'Emergency Recovery',      what: 'Answers 2 AM emergency calls. Knows average job values and routing. Allocated phone + monthly ROI tracking, live in minutes.', color: '#0369A1', slug: 'plumbing'     },
      { vertical: 'Legal',        label: 'Legal',        role: 'High-Value Intake',       what: 'Understands statute of limitations urgency. Screens case type and complexity. Phone allocated in minutes + monthly billing proof.', color: '#60A5FA', slug: 'legal'        },
      { vertical: 'Real Estate',  label: 'Real Estate',  role: 'Market-Aware Intake',     what: 'Knows buyer urgency and market timing. Captures property type, budget, timeline. Live in minutes with vertical context.', color: '#0EA5E9', slug: 'real-estate'  },
      { vertical: 'Insurance',    label: 'Insurance',    role: 'Quote Intelligence',      what: 'Understands coverage gaps and upsell opportunities. Knows insurance terminology. Live in minutes + monthly ROI report.', color: '#14B8A6', slug: 'insurance'    },
      { vertical: 'SaaS',         label: 'SaaS',         role: 'Trial Qualification',     what: 'Qualifies trial users by company size and use case. Knows SaaS language and ROI metrics. Allocated in minutes + monthly analytics.', color: '#8B5CF6', slug: 'saas'         },
      { vertical: 'Wholesale',    label: 'Wholesale',    role: 'Order Intelligence',      what: 'Captures order details and inventory urgency. Knows wholesale pricing and SKU routing. Live in minutes + ROI tracking.', color: '#84CC16', slug: 'wholesale'    },
      { vertical: 'Dental',       label: 'Dental',       role: 'Appointment Booking',     what: 'Captures new patient inquiries and books appointments. Knows insurance questions and common patient concerns. Live in minutes + monthly ROI.', color: '#EC4899', slug: 'dental'       },
    ],
    tech: ['Retell AI', 'Claude Sonnet (voice intelligence)', 'Cal.com (booking)', 'Supabase (lead storage)', 'Resend (confirmations)'],
  },

  rex: {
    slug:    'rex',
    name:    'Rex',
    role:    'Lead Follow-up Agent',
    status:  'live',
    color:   '#D4AF37',
    tagline: 'Follows up smart — each vertical gets its own language. Storm urgency, market timing, statute of limitations.',
    description: 'Rex is an autonomous follow-up agent that activates the moment a new lead enters your system. He fires a personalized email within 60 seconds of lead capture, then follows up at day 3 and day 7 until the prospect books, opts out, or converts. What makes Rex different: every message is written using vertical-specific language. Legal clients see statute-of-limitations urgency. Real estate clients see market-timing angles. SaaS customers see time-to-value ROI language. Not a generic blast — a message that speaks the language of your industry. SMS follow-up coming in phase 2.',
    how: [
      { step: 'Lead captured',         detail: 'A new lead arrives — via Ava\'s call, a cold email form, or the ROI calculator. Rex fires within 60 seconds of that event.' },
      { step: 'First contact sent',    detail: 'Rex sends a personalized email using the lead\'s name and specific issue. Not a blast — a message that sounds like it came from you.' },
      { step: 'Sequence activated',    detail: 'If the lead doesn\'t respond, Rex follows up at day 3 and day 7 with a different angle each time, then stops.' },
      { step: 'Booking detected',      detail: 'The moment a prospect books or replies, Rex stops the sequence automatically. No duplicate messages, no awkward follow-up after they\'ve already said yes.' },
      { step: 'Dashboard updated',     detail: 'Every message sent and every response received is logged. You see exactly where each lead is in the sequence without managing anything manually.' },
    ],
    deployments: [
      { vertical: 'Roofing',     label: 'Roofing',     role: 'Storm Alert Follow-up', what: 'Emphasizes storm urgency and insurance claim language. Day 0/3/7 sequence fires automatically. SMS coming soon.', color: '#FF4500', slug: 'roofing'     },
      { vertical: 'HVAC',        label: 'HVAC',        role: 'Service Follow-up',     what: 'Emphasizes emergency vs. maintenance triage. Day 0/3/7 sequence with HVAC-specific language and pricing angles.', color: '#FF6533', slug: 'hvac'        },
      { vertical: 'Plumbing',    label: 'Plumbing',    role: 'Service Follow-up',     what: 'Emphasizes emergency response and average job values. Day 0/3/7 sequence with plumbing industry language.', color: '#0369A1', slug: 'plumbing'    },
      { vertical: 'Legal',       label: 'Legal',       role: 'Case Recovery',         what: 'Emphasizes statute of limitations and case urgency. Day 0/3/7 sequence with legal-specific follow-up angles.', color: '#60A5FA', slug: 'legal'       },
      { vertical: 'Real Estate', label: 'Real Estate', role: 'Market Timing Follow-up', what: 'Emphasizes market timing and buyer urgency. Day 0/3/7 sequence with real-estate-specific urgency language.', color: '#0EA5E9', slug: 'real-estate' },
      { vertical: 'Insurance',   label: 'Insurance',   role: 'Quote Follow-up',        what: 'Emphasizes coverage gaps and rate-locking urgency. Day 0/3/7 sequence with insurance-specific pitch angles.', color: '#14B8A6', slug: 'insurance'   },
      { vertical: 'SaaS',        label: 'SaaS',        role: 'Trial Nurture',         what: 'Emphasizes time-to-value and ROI metrics. Day 0/3/7 sequence with SaaS growth language and case studies.', color: '#8B5CF6', slug: 'saas'        },
      { vertical: 'Wholesale',   label: 'Wholesale',   role: 'Order Follow-up',       what: 'Emphasizes inventory urgency and bulk-order pricing. Day 0/3/7 sequence with wholesale business language.', color: '#84CC16', slug: 'wholesale'   },
      { vertical: 'Dental',      label: 'Dental',      role: 'Patient Follow-up',     what: 'Emphasizes new patient value and appointment urgency. Day 0/3/7 sequence with dental-specific messaging.', color: '#EC4899', slug: 'dental'      },
    ],
    tech: ['Resend (email)', 'Twilio (SMS — coming soon)', 'Supabase (sequence state)', 'Vercel Cron (scheduling)', 'Claude (message personalization)'],
  },

  nova: {
    slug:    'nova',
    name:    'Nova',
    role:    'Appointment Confirmation',
    status:  'live',
    color:   '#D4AF37',
    tagline: 'Sends warm appointment confirmations automatically. Reviews coming in phase 2.',
    description: 'Nova is an autonomous confirmation agent that handles the follow-up work that falls through the cracks in every service business: appointments that get booked and then never properly confirmed, customers left wondering if it "really" went through. The moment an appointment is booked, Nova writes a personalized confirmation email with the date, time, location, and service details, and sends it immediately. She doesn\'t wait to be asked — she fires on the booking event itself. Review request automation is coming in phase 2.',
    how: [
      { step: 'Booking event fires',    detail: 'An appointment is booked — through Ava\'s call or your booking flow. Nova activates instantly on that event.' },
      { step: 'Confirmation written',   detail: 'Nova uses Claude to write a personalized confirmation email — customer name, appointment date/time/location, and service details. Warm and specific, not a template.' },
      { step: 'Delivered immediately',  detail: 'The confirmation goes out via email within seconds of the booking, while the customer is still thinking about it. SMS coming in phase 2.' },
      { step: 'Logged to dashboard',    detail: 'Every confirmation sent is logged in your dashboard. You have a full record of all outbound confirmations without touching email yourself.' },
      { step: 'Reviews coming phase 2', detail: 'In phase 2, Nova will also send review request emails after jobs are completed. For now, confirmations only.' },
    ],
    deployments: [
      { vertical: 'Roofing',     label: 'Roofing',     role: 'Appointment Confirmation', what: 'Sends personalized confirmation emails the moment a roof inspection is booked. Date, time, location, and preparation details.', color: '#FF4500', slug: 'roofing'     },
      { vertical: 'HVAC',        label: 'HVAC',        role: 'Appointment Confirmation', what: 'Sends personalized confirmation emails for service visits. Date, time, what to expect, and prep instructions.', color: '#FF6533', slug: 'hvac'        },
      { vertical: 'Plumbing',    label: 'Plumbing',    role: 'Appointment Confirmation', what: 'Sends personalized confirmation emails the moment a service visit is booked. Date, time, service details, and what to expect.', color: '#0369A1', slug: 'plumbing'    },
      { vertical: 'Legal',       label: 'Legal',       role: 'Consultation Confirmation', what: 'Sends personalized confirmation emails for consultation bookings. Date, time, attorney name, and what to bring.', color: '#60A5FA', slug: 'legal'       },
      { vertical: 'Real Estate', label: 'Real Estate', role: 'Showing Confirmation',     what: 'Sends personalized confirmation emails for property showings. Date, time, address, and showing details.', color: '#0EA5E9', slug: 'real-estate' },
      { vertical: 'Insurance',   label: 'Insurance',   role: 'Appointment Confirmation', what: 'Sends personalized confirmation emails for quote reviews. Date, time, coverage type, and what to review.', color: '#14B8A6', slug: 'insurance'   },
      { vertical: 'SaaS',        label: 'SaaS',        role: 'Demo Confirmation',        what: 'Sends personalized confirmation emails for demo bookings. Date, time, product focus, and attendee details.', color: '#8B5CF6', slug: 'saas'        },
      { vertical: 'Wholesale',   label: 'Wholesale',   role: 'Order Confirmation',       what: 'Sends personalized confirmation emails for order reviews. Date, time, SKU list, and order summary.', color: '#84CC16', slug: 'wholesale'   },
      { vertical: 'Dental',      label: 'Dental',      role: 'Appointment Confirmation', what: 'Sends personalized confirmation emails for dental appointments. Date, time, service type, and preparation instructions.', color: '#EC4899', slug: 'dental'      },
    ],
    tech: ['Claude API (confirmation copy)', 'Resend (email delivery)', 'Twilio (SMS delivery — coming soon)', 'Supabase (log + state)', 'Vercel Functions (trigger handling)'],
  },

  felix: {
    slug:    'felix',
    name:    'Felix',
    role:    'Conflict Check Agent (Legal Only)',
    status:  'live',
    color:   '#60A5FA',
    tagline: 'Exclusive to law firms. Flags conflicts before you\'ve spent time on the call.',
    description: 'Felix is a legal-exclusive agent that runs an automated conflict-of-interest screen on every new intake. The moment a potential client is captured — from a call with Ava or a web form — Felix cross-references their name and case details against your firm\'s prior intake history and immediately flags any plausible conflicts. If a conflict is flagged, the responsible attorney gets an instant email alert before the consultation is typically confirmed — so you can review and decide before you\'re in the room with a conflicted party. It\'s a fast first pass, not a replacement for your firm\'s formal conflict process. Felix is exclusive to legal practices on the Pro and Elite tiers.',
    how: [
      { step: 'New intake arrives',      detail: 'A potential client calls or submits a form. Ava captures their name and case type — what Felix needs to run the screen.' },
      { step: 'Prior intakes checked',   detail: 'Felix compares the new intake against your firm\'s prior captured leads and intakes for any name or case-type overlap.' },
      { step: 'Conflict evaluated',      detail: 'Claude assesses whether the overlap looks like a real, plausible conflict — not just a coincidental name match or shared case type.' },
      { step: 'Attorney notified',       detail: 'If a plausible conflict is found, the responsible attorney gets an immediate email alert with the details — before the consultation is typically confirmed.' },
      { step: 'Logged to dashboard',     detail: 'Every screen run — clear or flagged — is logged, so you have a record even if nothing came of it.' },
    ],
    deployments: [
      { vertical: 'Legal', label: 'Legal', role: 'Conflict Screen', what: 'Cross-references every new intake against your prior captured leads. Alerts the responsible attorney immediately if a plausible conflict is flagged.', color: '#60A5FA', slug: 'legal' },
    ],
    tech: ['Supabase (client + conflict database)', 'Claude (conflict evaluation logic)', 'Resend (attorney alert email)', 'Vercel Functions (intake gate)'],
  },

  scout: {
    slug:    'scout',
    name:    'Scout',
    role:    'Trial User Qualifier (SaaS Only)',
    status:  'deploying',
    color:   '#8B5CF6',
    tagline: 'Exclusive to SaaS. Qualifies trial users the moment they call. Gets the right info.',
    description: 'Scout is a SaaS-exclusive agent that qualifies trial users during their first inbound call. The moment a trial signup call arrives, Scout asks the right discovery questions — company size, use case, team, timeline, budget — and captures the data that matters for onboarding. He asks like a sales engineer, not a chatbot. Every trial qualification is logged to your dashboard with structured fields, so your onboarding team knows exactly what to focus on during the trial. Scout is exclusive to SaaS companies on the Pro and Elite tiers.',
    how: [
      { step: 'Trial signup call arrives',    detail: 'A new trial user calls or books a demo call. Scout activates on that inbound event.' },
      { step: 'Discovery questions asked',   detail: 'Scout asks about company size, use case, current tools, team structure, timeline, and budget. He asks like a sales engineer, not a script.' },
      { step: 'Answers captured',            detail: 'Every answer is captured and structured. Company name, team size, use case, timeline, estimated budget all land in your SaaS dashboard.' },
      { step: 'Logged to dashboard',         detail: 'Your onboarding team sees the full qualification profile before the trial even starts. They know exactly what to demo, who to focus on, and what timeline to work with.' },
      { step: 'Onboarding team prepared',    detail: 'With Scout\'s data in hand, your onboarding team can personalize the trial experience and track against the qualification data throughout.' },
    ],
    deployments: [
      { vertical: 'SaaS', label: 'SaaS', role: 'Trial Qualifier', what: 'Asks the right discovery questions during trial signup calls. Captures company size, use case, team, timeline, budget. Logs structured data to your dashboard.', color: '#8B5CF6', slug: 'saas' },
    ],
    tech: ['Retell AI (call handling)', 'Claude (discovery questions)', 'Supabase (qualification data storage)', 'Vercel Functions (dashboard logging)'],
  },
}

// ── Static Params ─────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return (Object.keys(AGENTS) as AgentSlug[]).map(slug => ({ agent: slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ agent: string }> }): Promise<Metadata> {
  const { agent: slug } = await params
  const data = AGENTS[slug as AgentSlug]
  if (!data) return {}
  return {
    title:       `${data.name} — ${data.role} | 369 Agentic Systems`,
    description: data.tagline,
  }
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS = {
  live:      { label: 'LIVE',      color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)'  },
  deploying: { label: 'DEPLOYING', color: '#D4AF37', bg: 'rgba(212,175,55,0.08)', border: 'rgba(212,175,55,0.25)' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AgentPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent: slug } = await params
  const data = AGENTS[slug as AgentSlug]
  if (!data) notFound()

  const status = STATUS[data.status]

  return (
    <div style={{ background: '#0A0A0A', minHeight: '100vh', color: '#F0F0F0', fontFamily: 'var(--font-inter, Inter, sans-serif)' }}>
      <style suppressHydrationWarning>{`
        @media (max-width: 760px) {
          .agent-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .agent-hero-grid > div:last-child { max-width: 320px; margin-inline: auto; }
        }
      `}</style>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 100, borderBottom: '1px solid rgba(148,163,184,0.07)', background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontWeight: 600, fontSize: '1.2rem', letterSpacing: '-0.02em', color: '#F0F0F0', textDecoration: 'none' }}>
            369<span style={{ color: '#D4AF37' }}> Agentic Systems</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Link href="/#agents" style={{ color: '#94A3B8', fontSize: '0.875rem', textDecoration: 'none' }}>← All Agents</Link>
            <Link href="/book-demo" style={{ padding: '8px 18px', background: '#D4AF37', color: '#0A0A0A', borderRadius: 7, fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              Book a Call
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 120, paddingBottom: 80, paddingLeft: 28, paddingRight: 28, position: 'relative', overflow: 'hidden' }}>
        {/* Ambient glow */}
        <div aria-hidden style={{ position: 'absolute', top: '10%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${data.color}0F 0%, transparent 70%)`, pointerEvents: 'none', filter: 'blur(40px)' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '10%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${data.color}08 0%, transparent 70%)`, pointerEvents: 'none', filter: 'blur(60px)' }} />

        <div className="agent-hero-grid" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 400px', gap: 80, alignItems: 'center' }}>

          {/* Left: info */}
          <div>
            {/* Status badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 99, background: status.bg, border: `1px solid ${status.border}`, marginBottom: 24 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block', boxShadow: data.status === 'live' ? `0 0 6px ${status.color}` : 'none' }} />
              <span style={{ color: status.color, fontSize: '0.72rem', fontFamily: 'monospace', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{status.label}</span>
            </div>

            {/* Role label */}
            <p style={{ margin: '0 0 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              // {data.role}
            </p>

            {/* Name */}
            <h1 style={{ margin: '0 0 20px', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontSize: 'clamp(3.5rem, 8vw, 6rem)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: data.color }}>
              {data.name}
            </h1>

            {/* Tagline */}
            <p style={{ margin: '0 0 36px', fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: '#94A3B8', lineHeight: 1.65, maxWidth: 560 }}>
              {data.tagline}
            </p>

            {/* CTA row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/book-demo" style={{ padding: '13px 28px', background: `linear-gradient(135deg, ${data.color} 0%, ${data.color}CC 100%)`, color: '#0A0A0A', borderRadius: 8, fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', letterSpacing: '0.01em' }}>
                Deploy {data.name} →
              </Link>
              <Link href="/#agents" style={{ color: '#94A3B8', fontSize: '0.875rem', textDecoration: 'none' }}>
                See full roster
              </Link>
            </div>
          </div>

          {/* Right: agent image */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: 20, overflow: 'hidden', border: `1px solid ${data.color}22`, boxShadow: `0 0 80px ${data.color}14` }}>
              <Image
                src={`/img/agents/${data.slug}/${data.slug}_original.jpg`}
                alt={`${data.name} — ${data.role}`}
                fill
                className="object-cover"
                sizes="400px"
                priority
              />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${data.color}33 0%, transparent 55%)`, pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Description ───────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 28px', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <p style={{ margin: '0 0 10px', fontFamily: 'monospace', fontSize: '0.72rem', color: data.color, textTransform: 'uppercase', letterSpacing: '0.2em' }}>// WHAT {data.name.toUpperCase()} DOES</p>
          <p style={{ margin: 0, fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', color: '#CBD5E1', lineHeight: 1.8 }}>
            {data.description}
          </p>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 28px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(148,163,184,0.07)', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <p style={{ margin: '0 0 10px', fontFamily: 'monospace', fontSize: '0.72rem', color: data.color, textTransform: 'uppercase', letterSpacing: '0.2em' }}>// HOW {data.name.toUpperCase()} WORKS</p>
          <h2 style={{ margin: '0 0 48px', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Five steps. Fully autonomous.
          </h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data.how.map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: 24, paddingBottom: i < data.how.length - 1 ? 40 : 0, position: 'relative' }}>
                {/* Line */}
                {i < data.how.length - 1 && (
                  <div aria-hidden style={{ position: 'absolute', left: 19, top: 40, bottom: 0, width: 1, background: `linear-gradient(to bottom, ${data.color}40, transparent)` }} />
                )}
                {/* Number */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${data.color}14`, border: `1px solid ${data.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: data.color, fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</span>
                </div>
                {/* Content */}
                <div style={{ paddingTop: 8 }}>
                  <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontWeight: 600, fontSize: '1rem', color: '#F0F0F0' }}>{item.step}</p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748B', lineHeight: 1.65 }}>{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Vertical Deployments ───────────────────────────────────────────── */}
      <section style={{ padding: '80px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ margin: '0 0 10px', fontFamily: 'monospace', fontSize: '0.72rem', color: data.color, textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}>// MARKETS</p>
          <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, textAlign: 'center' }}>
            {data.name} across every vertical
          </h2>
          <p style={{ margin: '0 0 56px', color: '#64748B', fontSize: '0.95rem', textAlign: 'center', maxWidth: 480, marginInline: 'auto' }}>
            Same agent. Vertical-specific intelligence. Deployed differently in each market.
          </p>

          <DeploymentCards deployments={data.deployments} />
        </div>
      </section>

      {/* ── Tech Stack ────────────────────────────────────────────────────── */}
      <section style={{ padding: '64px 28px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <p style={{ margin: '0 0 10px', fontFamily: 'monospace', fontSize: '0.72rem', color: data.color, textTransform: 'uppercase', letterSpacing: '0.2em' }}>// INFRASTRUCTURE</p>
          <h2 style={{ margin: '0 0 32px', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontSize: '1.6rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            What powers {data.name}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {data.tech.map((t) => (
              <div key={t} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 8, fontSize: '0.82rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 28px', textAlign: 'center', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <p style={{ margin: '0 0 10px', fontFamily: 'monospace', fontSize: '0.72rem', color: data.color, textTransform: 'uppercase', letterSpacing: '0.2em' }}>// DEPLOY {data.name.toUpperCase()}</p>
          <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Ready to put {data.name} to work?
          </h2>
          <p style={{ margin: '0 0 36px', color: '#64748B', fontSize: '0.95rem', lineHeight: 1.65 }}>
            30 minutes. We map your pipeline, show you exactly what {data.name} handles, and deploy within minutes of signup.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/book-demo" style={{ padding: '14px 32px', background: `linear-gradient(135deg, ${data.color} 0%, ${data.color}CC 100%)`, color: '#0A0A0A', borderRadius: 8, fontSize: '1rem', fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-display, Instrument Sans, sans-serif)' }}>
              Book a Strategy Call →
            </Link>
            <Link href="/#agents" style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.12)', color: '#94A3B8', borderRadius: 8, fontSize: '1rem', fontWeight: 500, textDecoration: 'none' }}>
              See full roster
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ padding: '36px 28px', borderTop: '1px solid rgba(148,163,184,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, maxWidth: 1200, margin: '0 auto' }}>
        <Link href="/" style={{ fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontWeight: 600, fontSize: '1.1rem', color: '#F0F0F0', textDecoration: 'none' }}>
          369<span style={{ color: '#D4AF37' }}> Agentic Systems</span>
        </Link>
        <p style={{ margin: 0, color: '#334155', fontSize: '0.78rem' }}>© 2026 369 Agentic Systems. All rights reserved.</p>
      </footer>

    </div>
  )
}

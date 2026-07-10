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
    tagline: 'The always-on first responder. Every call answered. Every lead captured. Every time.',
    description: 'Ava is a fully autonomous AI receptionist deployed on a real phone number. She answers every inbound call in under 60 seconds — nights, weekends, holidays — qualifies the caller, captures their contact information, and either books an appointment directly on your calendar or routes the call to the right person. She never sends anyone to voicemail. Every call she handles is logged, transcribed, and available on your dashboard the moment it ends.',
    how: [
      { step: 'Inbound call arrives',     detail: 'Your business number rings. Ava answers within 2–3 rings, 24 hours a day, 365 days a year. There is no voicemail.' },
      { step: 'Caller qualified',          detail: 'Ava identifies the nature of the call using a vertical-specific script — storm damage vs. new roof, emergency vs. scheduled service, buyer vs. renter. She asks the right questions without sounding like a robot.' },
      { step: 'Lead data captured',        detail: 'Caller name, phone number, address, issue description, and urgency are extracted and written to your dashboard in real time. You see the lead the moment the call ends.' },
      { step: 'Booking or escalation',     detail: 'If the caller is ready to schedule, Ava books directly on your Cal.com calendar and sends a confirmation. If it\'s an emergency, she escalates to your on-call tech immediately.' },
      { step: 'Post-call summary',         detail: 'A full transcript and AI summary appear in your dashboard. You know exactly what was said without listening to recordings.' },
    ],
    deployments: [
      { vertical: 'Roofing',      label: 'Roofing',      role: 'Storm Call Capture',      what: 'Captures storm damage inquiries and new roof leads 24/7. Knows the difference between an insurance claim call and a cash buyer.', color: '#FF4500', slug: 'roofing'      },
      { vertical: 'HVAC',         label: 'HVAC',         role: '24/7 Emergency Handling', what: 'Triages AC failures, heating emergencies, and maintenance requests. Routes emergencies to on-call tech immediately.', color: '#FF6533', slug: 'hvac'         },
      { vertical: 'Plumbing',     label: 'Plumbing',     role: 'Emergency Recovery',      what: 'Answers burst pipe and sewage backup calls at 2 AM. Dispatches your on-call plumber and emails the customer ETA.', color: '#0369A1', slug: 'plumbing'     },
      { vertical: 'Legal',        label: 'Legal',        role: 'High-Value Intake',       what: 'Captures new case inquiries and schedules consultations. Screens for case type and urgency before attorney time is spent.', color: '#60A5FA', slug: 'legal'        },
      { vertical: 'Real Estate',  label: 'Real Estate',  role: 'Buyer Call Handling',     what: 'Answers buyer and seller inquiries around the clock. Captures property interest, budget, and timeline — qualifies before agent time is spent.', color: '#0EA5E9', slug: 'real-estate'  },
      { vertical: 'Insurance',    label: 'Insurance',    role: 'Quote Call Capture',      what: 'Handles new policy inquiries and existing client calls. Captures coverage needs and schedules agent follow-up.', color: '#14B8A6', slug: 'insurance'    },
      { vertical: 'SaaS',         label: 'SaaS',         role: 'Demo Request Handling',   what: 'Answers inbound demo requests and trial support calls. Qualifies company size and use case before scheduling.', color: '#8B5CF6', slug: 'saas'         },
      { vertical: 'Wholesale',    label: 'Wholesale',    role: 'Order Intake',            what: 'Captures inbound orders, confirms SKUs and quantities, and routes to the fulfillment team automatically.', color: '#84CC16', slug: 'wholesale'    },
    ],
    tech: ['Retell AI', 'Claude Sonnet (voice intelligence)', 'Twilio (phone number)', 'Cal.com (booking)', 'Supabase (lead storage)', 'Resend (confirmations)'],
  },

  rex: {
    slug:    'rex',
    name:    'Rex',
    role:    'Outreach + Follow-up',
    status:  'deploying',
    color:   '#D4AF37',
    tagline: 'Never lets a lead go cold. Fires follow-up within 60 seconds. Runs the sequence for a week.',
    description: 'Rex is an autonomous outreach agent that activates the moment a new lead enters your system. He fires a personalized email within 60 seconds of lead capture (SMS coming soon), then follows up at day 3 and day 7 until the prospect books, opts out, or converts. Every message is written using the lead\'s name and the specific issue they called about — not a generic blast — with the tone and urgency adjusted for the vertical. Rex turns your lead list from a static spreadsheet into an active pipeline that works while you sleep.',
    how: [
      { step: 'Lead captured',         detail: 'A new lead arrives — via Ava\'s call, a cold email form, or the ROI calculator. Rex fires within 60 seconds of that event.' },
      { step: 'First contact sent',    detail: 'Rex sends a personalized email using the lead\'s name and specific issue. Not a blast — a message that sounds like it came from you.' },
      { step: 'Sequence activated',    detail: 'If the lead doesn\'t respond, Rex follows up at day 3 and day 7 with a different angle each time, then stops.' },
      { step: 'Booking detected',      detail: 'The moment a prospect books or replies, Rex stops the sequence automatically. No duplicate messages, no awkward follow-up after they\'ve already said yes.' },
      { step: 'Dashboard updated',     detail: 'Every message sent and every response received is logged. You see exactly where each lead is in the sequence without managing anything manually.' },
    ],
    deployments: [
      { vertical: 'Roofing',     label: 'Roofing',     role: 'Storm Alert Follow-up', what: 'Fires a personalized email within 60 seconds of a roof-damage lead being captured, then follows up at day 3 and day 7 until they book (SMS coming soon).', color: '#FF4500', slug: 'roofing'     },
      { vertical: 'HVAC',        label: 'HVAC',        role: 'Service Follow-up',     what: 'Fires a personalized email within 60 seconds of an HVAC lead being captured, then follows up at day 3 and day 7 until they book a service call.', color: '#FF6533', slug: 'hvac'        },
      { vertical: 'Plumbing',    label: 'Plumbing',    role: 'Service Follow-up',     what: 'Fires a personalized email within 60 seconds of a plumbing lead being captured, then follows up at day 3 and day 7 until they book a service call.', color: '#0369A1', slug: 'plumbing'    },
      { vertical: 'Legal',       label: 'Legal',       role: 'Lead Recovery',         what: 'Planned: follows up on every intake that didn\'t book a consultation, using the same day-0/day-3/day-7 email sequence.', color: '#60A5FA', slug: 'legal'       },
      { vertical: 'Real Estate', label: 'Real Estate', role: 'Speed-to-Lead',         what: 'Planned: emails new buyer leads within 60 seconds of inquiry, then follows up at day 3 and day 7.', color: '#0EA5E9', slug: 'real-estate' },
      { vertical: 'Insurance',   label: 'Insurance',   role: 'Lead Follow-up',        what: 'Planned: same day-0/day-3/day-7 email sequence, adapted to quote-request follow-up.', color: '#14B8A6', slug: 'insurance'   },
      { vertical: 'SaaS',        label: 'SaaS',        role: 'Trial Follow-up',       what: 'Planned: same day-0/day-3/day-7 email sequence, adapted to trial-signup nurture.', color: '#8B5CF6', slug: 'saas'        },
      { vertical: 'Wholesale',   label: 'Wholesale',   role: 'Order Follow-up',       what: 'Planned: same day-0/day-3/day-7 email sequence, adapted to purchase-order follow-up.', color: '#84CC16', slug: 'wholesale'   },
    ],
    tech: ['Resend (email)', 'Twilio (SMS — coming soon)', 'Supabase (sequence state)', 'Vercel Cron (scheduling)', 'Claude (message personalization)'],
  },

  nova: {
    slug:    'nova',
    name:    'Nova',
    role:    'Intelligence + Delivery',
    status:  'deploying',
    color:   '#D4AF37',
    tagline: 'Confirms every booked appointment automatically — personal, not a template.',
    description: 'Nova is an autonomous delivery agent that handles the confirmation work that falls through the cracks in every service business: appointments that get booked and then never properly confirmed, customers left wondering if it "really" went through. The moment an appointment is booked, Nova writes a warm, specific confirmation email with the date, time, and service details, and sends it via email (SMS coming soon). She doesn\'t wait to be asked — she fires on the booking event itself.',
    how: [
      { step: 'Booking event fires',    detail: 'An appointment is booked — through Ava\'s call or your booking flow. Nova activates on that event, not a schedule.' },
      { step: 'Confirmation written',   detail: 'Nova uses Claude to write a short, specific confirmation email — the customer\'s name, appointment date/time, and service, plus a warm note on what to expect. Not a template.' },
      { step: 'Delivered immediately',  detail: 'The confirmation goes out via email within seconds of the booking, while the customer is still thinking about it.' },
      { step: 'Response routed',        detail: 'If the customer replies with a question or change, the reply comes straight to your inbox to handle.' },
      { step: 'Logged to dashboard',    detail: 'Every confirmation sent is logged in your dashboard. You have a full record without touching email yourself.' },
    ],
    deployments: [
      { vertical: 'Roofing',     label: 'Roofing',     role: 'Appointment Confirmation', what: 'Sends a personalized confirmation email the moment a roof inspection is booked — date, time, and what to expect (SMS coming soon).', color: '#FF4500', slug: 'roofing'     },
      { vertical: 'HVAC',        label: 'HVAC',        role: 'Appointment Confirmation', what: 'Sends a personalized confirmation email the moment a service visit is booked — date, time, and how to prepare.', color: '#FF6533', slug: 'hvac'        },
      { vertical: 'Plumbing',    label: 'Plumbing',    role: 'Appointment Confirmation', what: 'Sends a personalized confirmation email the moment a service visit is booked — date, time, and what to expect.', color: '#0369A1', slug: 'plumbing'    },
      { vertical: 'Legal',       label: 'Legal',       role: 'Appointment Confirmation', what: 'Planned: same personalized confirmation-email flow, adapted to consultation bookings.', color: '#60A5FA', slug: 'legal'       },
      { vertical: 'Real Estate', label: 'Real Estate', role: 'Showing Confirmation',     what: 'Planned: same personalized confirmation-email flow, adapted to showing bookings.', color: '#0EA5E9', slug: 'real-estate' },
      { vertical: 'Insurance',   label: 'Insurance',   role: 'Appointment Confirmation', what: 'Planned: same personalized confirmation-email flow, adapted to quote-review bookings.', color: '#14B8A6', slug: 'insurance'   },
      { vertical: 'SaaS',        label: 'SaaS',        role: 'Demo Confirmation',        what: 'Planned: same personalized confirmation-email flow, adapted to demo bookings.', color: '#8B5CF6', slug: 'saas'        },
      { vertical: 'Wholesale',   label: 'Wholesale',   role: 'Order Confirmation',       what: 'Planned: same personalized confirmation-email flow, adapted to order-review bookings.', color: '#84CC16', slug: 'wholesale'   },
    ],
    tech: ['Claude API (confirmation copy)', 'Resend (email delivery)', 'Twilio (SMS delivery — coming soon)', 'Supabase (log + state)', 'Vercel Functions (trigger handling)'],
  },

  felix: {
    slug:    'felix',
    name:    'Felix',
    role:    'Conflict Check Agent',
    status:  'live',
    color:   '#60A5FA',
    tagline: 'Flags conflicts before you\'ve spent time on the call. Every intake. Every time.',
    description: 'Felix is a legal-exclusive agent that runs an automated conflict screen on every new intake. The moment a new potential client is captured — from a call with Ava or a web form — Felix cross-references their name and case details against your prior intake history and flags anything that looks like a plausible conflict. If something\'s flagged, the responsible attorney gets an immediate email alert — before you\'d typically confirm the consultation — so you can review it and decide before you\'re in the room with a conflicted party. It\'s a fast first pass, not a replacement for your firm\'s formal conflicts process.',
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
    role:    'Competitor Intelligence',
    status:  'deploying',
    color:   '#8B5CF6',
    tagline: 'Finds the gaps your competitors left open — before they notice they exist.',
    description: 'Scout is a SaaS-exclusive intelligence agent that monitors your competitors\' websites and content every week, identifies the topics and keywords they\'re not covering well, and generates actionable intelligence reports your team can act on. He doesn\'t just tell you what your competitors are doing — he shows you where they\'re weak and what you can publish to take that ground. Every week, Scout delivers a prioritized hit list: the exact content gaps that represent ranking opportunities, the competitor moves worth watching, and the terms where you can win without going head-to-head.',
    how: [
      { step: 'Competitor list configured',   detail: 'You give Scout the URLs of your top 3–5 competitors. He monitors them every week — any new content, any new pages, any ranking changes.' },
      { step: 'Content mapped',               detail: 'Scout crawls competitor content using Firecrawl and maps every topic and keyword they\'ve covered. This becomes the baseline for gap analysis.' },
      { step: 'Gaps identified',              detail: 'Scout compares their coverage against your own content and against search demand data. Topics they\'ve missed or covered poorly become your opportunities.' },
      { step: 'Intelligence report generated', detail: 'Claude synthesizes the gap analysis into a weekly report: top 5 content opportunities, competitor moves to watch, and a recommended publish schedule.' },
      { step: 'Report delivered',             detail: 'The report lands in your inbox every Monday morning. Prioritized, actionable, specific — not a data dump. What to write, why it matters, what it\'ll take.' },
    ],
    deployments: [
      { vertical: 'SaaS', label: 'SaaS', role: 'Intelligence Agent', what: 'Monitors your top competitors weekly, identifies content and keyword gaps, and delivers a prioritized intelligence report every Monday morning.', color: '#8B5CF6', slug: 'saas' },
    ],
    tech: ['Firecrawl (web monitoring)', 'Claude API (gap analysis + report generation)', 'Resend (weekly report delivery)', 'Supabase (competitor config + history)', 'Vercel Cron (weekly trigger)'],
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
            30 minutes. We map your pipeline, show you exactly what {data.name} handles, and deploy within 72 hours.
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

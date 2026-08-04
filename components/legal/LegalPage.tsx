import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Shared chrome for /privacy and /terms.
 *
 * Deliberately a plain Server Component with inline styles: these two pages must render for an
 * unauthenticated visitor (and for Google's verification reviewer) with no client JavaScript and
 * no dependency on the marketing site's stylesheet, which lives in static HTML outside Next.js.
 *
 * Lives under components/, not app/ — `app/legal` is the legal *vertical* landing
 * page for law firms, an entirely different thing that already owns that route.
 */

const GOLD = '#D4AF37'
const BG = '#0A0A0A'
const TEXT = '#E2E8F0'
const MUTED = '#94A3B8'
const BORDER = 'rgba(255,255,255,0.08)'

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 88px' }}>
        <Link href="/" style={{ color: MUTED, textDecoration: 'none', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
          ← 369 Agentic Systems
        </Link>

        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 700, color: '#FFFFFF', margin: '28px 0 10px', lineHeight: 1.15 }}>
          {title}
        </h1>
        <p style={{ color: MUTED, fontSize: '0.82rem', fontFamily: 'ui-monospace, monospace', margin: '0 0 40px' }}>
          Last updated {updated}
        </p>

        {children}

        <footer style={{ marginTop: 56, paddingTop: 24, borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Link href="/privacy" style={{ color: MUTED, fontSize: '0.8rem', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: MUTED, fontSize: '0.8rem', textDecoration: 'none' }}>Terms of Service</Link>
          <a href="mailto:chris@369agenticsystems.com" style={{ color: MUTED, fontSize: '0.8rem', textDecoration: 'none' }}>
            chris@369agenticsystems.com
          </a>
        </footer>
      </div>
    </main>
  )
}

export function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: GOLD, margin: '0 0 14px', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function P({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: '0.94rem', lineHeight: 1.75, color: TEXT, margin: '0 0 14px' }}>{children}</p>
}

export function UL({ children }: { children: ReactNode }) {
  return <ul style={{ margin: '0 0 14px', paddingLeft: 20 }}>{children}</ul>
}

export function LI({ children }: { children: ReactNode }) {
  return <li style={{ fontSize: '0.94rem', lineHeight: 1.75, color: TEXT, marginBottom: 10 }}>{children}</li>
}

/** Wide tables scroll inside their own container so the page body never scrolls sideways. */
export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '0 0 16px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
        <thead>
          <tr>
            {head.map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '9px 12px', borderBottom: `1px solid ${BORDER}`,
                color: MUTED, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '11px 12px', borderBottom: `1px solid ${BORDER}`,
                  fontSize: '0.86rem', lineHeight: 1.6, color: j === 0 ? '#FFFFFF' : MUTED,
                  verticalAlign: 'top',
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

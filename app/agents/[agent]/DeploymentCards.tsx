'use client'

import Link from 'next/link'

interface VerticalDeployment {
  vertical: string
  label:    string
  role:     string
  what:     string
  color:    string
  slug:     string
}

export function DeploymentCards({ deployments }: { deployments: VerticalDeployment[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
      {deployments.map((dep) => (
        <Link key={dep.vertical} href={`/${dep.slug}`} style={{ textDecoration: 'none' }}>
          <div
            style={{
              padding: 28, borderRadius: 14,
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${dep.color}22`,
              transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
              display: 'block',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = `${dep.color}55`
              el.style.transform = 'translateY(-3px)'
              el.style.boxShadow = `0 12px 40px ${dep.color}12`
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = `${dep.color}22`
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = 'none'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '0.68rem', color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{dep.vertical}</p>
                <p style={{ margin: 0, fontFamily: 'var(--font-display, Instrument Sans, sans-serif)', fontWeight: 600, fontSize: '1.05rem', color: dep.color }}>{dep.role}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: '#475569', marginTop: 4, flexShrink: 0 }}>
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.6 }}>{dep.what}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

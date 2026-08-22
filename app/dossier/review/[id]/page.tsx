/**
 * The review page. Step 6 — where a human actually reads a dossier before a prospect does.
 *
 * Server-rendered and reached only from a signed link in the nudge email. The token authorises
 * VIEWING; approving is a POST from the form below, because mail scanners fetch every URL in a
 * message and a GET approval would send every dossier unread.
 *
 * The dossier is shown exactly as it will arrive — the stored HTML, in a sandboxed iframe — rather
 * than re-rendered from the source data. Approving something that looks slightly different from
 * what gets sent would make the gate decorative.
 */
import type { ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { verifyDossierToken } from '@/lib/security/dossier-token'
import ApproveForm from './ApproveForm'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function shell(title: string, body: ReactNode) {
  return (
    <main style={{
      background: '#0A0A0A', color: '#CBD5E1', minHeight: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{
          margin: '0 0 8px', fontSize: 11, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: '#D4AF37', fontFamily: 'monospace',
        }}>
          369 Agentic Systems
        </p>
        <h1 style={{ margin: '0 0 20px', fontSize: 24, color: '#fff', letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {body}
      </div>
    </main>
  )
}

export default async function ReviewPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { id } = await params
  const { t } = await searchParams

  const check = verifyDossierToken(t, id)
  if (!check.valid) {
    return shell('That link will not open', (
      <p style={{ lineHeight: 1.7 }}>
        {check.reason === 'expired'
          ? 'This review link has expired. Nothing was sent — ask for a fresh one.'
          : 'This link is not valid for this dossier. Nothing was sent.'}
      </p>
    ))
  }

  const { data } = await supabaseAdmin
    .from('dossiers')
    .select('id, status, to_email, subject, html, omitted, built_at, sent_at')
    .eq('id', id).limit(1)

  const row = data?.[0]
  if (!row) return shell('Not found', <p>No dossier with that id.</p>)

  const omitted = (row.omitted ?? []) as Array<{ id: string; why: string }>
  const settled = row.status !== 'pending'

  return shell(settled ? `Already ${row.status}` : 'Ready for you to read', (
    <>
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '16px 18px', marginBottom: 22, fontSize: 14, lineHeight: 1.6,
      }}>
        <div><strong style={{ color: '#fff' }}>To</strong>{' '}{row.to_email}</div>
        <div style={{ marginTop: 6 }}>
          <strong style={{ color: '#fff' }}>Subject</strong>{' '}{row.subject}
        </div>
        {omitted.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#94A3B8' }}>
            <strong style={{ color: '#F0F0F0' }}>Left out, and why:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {omitted.map(o => <li key={o.id}>{o.id} — {o.why}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Exactly what will arrive. `sandbox=""` withholds every capability: this is our own
          generated markup, but stored HTML rendered back into a page deserves the same caution
          regardless of who wrote it. */}
      <iframe
        srcDoc={row.html}
        sandbox=""
        title="Dossier preview"
        style={{
          width: '100%', height: 620, border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, background: '#0A0A0A',
        }}
      />

      {settled
        ? (
          <p style={{ marginTop: 20, color: '#94A3B8', lineHeight: 1.7 }}>
            This one is already {row.status}
            {row.sent_at ? ` (sent ${new Date(row.sent_at).toLocaleString()})` : ''}.
            Nothing further will happen.
          </p>
        )
        : <ApproveForm id={id} token={t ?? ''} to={row.to_email ?? ''} />}
    </>
  ))
}

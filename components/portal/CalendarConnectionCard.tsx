'use client'

import { useState } from 'react'
import { CalendarCheck, CalendarX, AlertTriangle } from 'lucide-react'

/**
 * Connect / disconnect the owner's Google Calendar.
 *
 * Consent has to be initiated by the owner — the privacy policy says so and Google's review
 * checks it — so this card is the only entry point. There is deliberately no admin path that
 * connects a calendar on a client's behalf.
 */

export type CalendarConnectionState = {
  status:        'active' | 'revoked' | 'error'
  accountEmail:  string | null
  lastOkAt:      string | null
  lastError:     string | null
} | null

/**
 * Every failure the OAuth routes can redirect back with. Anything unmapped still renders,
 * showing the raw code rather than swallowing it — an unexplained silent failure on this screen
 * is worse than an ugly string.
 */
const ERROR_COPY: Record<string, string> = {
  cancelled:        'Connection cancelled — no changes were made.',
  state_mismatch:   'That connection link had expired. Please try again.',
  missing_scopes:   'Some permissions were not granted. Ava needs both “see when you’re busy” and “edit events” to avoid double-booking you.',
  no_refresh_token: 'Google did not return a lasting token. Please try again, or contact support if it repeats.',
  probe_failed:     'We connected, but could not read the calendar. Check that the Google account you chose actually has a calendar.',
  not_configured:   'Calendar connection is not configured yet on our side. We have been notified.',
  no_code:          'Google did not send an authorisation code. Please try again.',
  google_error:     'Google refused the connection. Please try again.',
  exchange_failed:  'We could not complete the connection with Google. Please try again.',
  store_failed:     'We could not save the connection. Please try again.',
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24)  return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function CalendarConnectionCard({
  connection,
  errorCode,
  justConnected,
}: {
  connection:    CalendarConnectionState
  errorCode:     string | null
  justConnected: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function disconnect() {
    if (!confirm('Disconnect your Google Calendar? Ava will go back to using only her own booking record, and may offer times you are busy.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
      if (res.ok) window.location.href = '/client-dashboard'
      else {
        alert('Could not disconnect the calendar. Please try again.')
        setBusy(false)
      }
    } catch {
      alert('Could not disconnect the calendar. Please try again.')
      setBusy(false)
    }
  }

  const isDown = connection !== null && connection.status !== 'active'

  return (
    <div
      className="rounded-xl border p-4 mb-5"
      style={
        isDown
          ? { borderColor: 'rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.05)' }
          : { borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isDown
            ? <AlertTriangle size={16} style={{ color: '#F87171' }} />
            : connection
              ? <CalendarCheck size={16} style={{ color: '#4ADE80' }} />
              : <CalendarX size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>

        <div className="flex-1 min-w-0">
          {/* ── Connected and healthy ─────────────────────────────── */}
          {connection && !isDown && (
            <>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Google Calendar connected</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 break-all">
                {connection.accountEmail ?? 'Google account'}
                {connection.lastOkAt && <> · checked {timeAgo(connection.lastOkAt)}</>}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                Ava checks this calendar before offering a caller a time, and adds every booking to it.
              </p>
              <button
                onClick={disconnect}
                disabled={busy}
                className="mt-2.5 text-xs font-semibold underline text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                {busy ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </>
          )}

          {/* ── Connected but broken ──────────────────────────────── */}
          {isDown && (
            <>
              <p className="text-sm font-semibold" style={{ color: '#F87171' }}>
                Calendar disconnected — Ava has stopped booking
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Access to {connection?.accountEmail ?? 'your Google account'} was revoked or has expired. Rather
                than risk offering a caller a time you are busy, Ava is now taking messages instead of booking.
                Reconnecting fixes it immediately.
              </p>
              {connection?.lastError && (
                <p className="text-[11px] font-mono text-[var(--text-muted)] mt-1.5 break-all opacity-70">
                  {connection.lastError}
                </p>
              )}
              <a
                href="/api/calendar/google/connect"
                className="inline-block mt-2.5 px-4 py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                style={{ background: '#D4AF37', color: '#000' }}
              >
                Reconnect Google Calendar
              </a>
            </>
          )}

          {/* ── Never connected ───────────────────────────────────── */}
          {!connection && (
            <>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Connect your Google Calendar</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Ava currently books against her own record only, so she can offer a caller a time you are
                already busy. Connecting your calendar lets her see when you are free and put every booking
                straight onto it.
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5 opacity-80">
                She sees only busy and free times — never the contents of your events.
              </p>
              <a
                href="/api/calendar/google/connect"
                className="inline-block mt-2.5 px-4 py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                style={{ background: '#D4AF37', color: '#000' }}
              >
                Connect Google Calendar
              </a>
            </>
          )}

          {justConnected && !connection && (
            <p className="text-xs mt-2" style={{ color: '#4ADE80' }}>Connected — refresh in a moment if this does not update.</p>
          )}

          {errorCode && (
            <p className="text-xs mt-2" style={{ color: errorCode === 'cancelled' ? 'var(--text-muted)' : '#F87171' }}>
              {ERROR_COPY[errorCode] ?? `Connection failed (${errorCode}).`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

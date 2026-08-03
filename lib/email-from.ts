export const FALLBACK_FROM_ADDRESS = 'alerts@alerts.369agenticsystems.com'

/**
 * Builds a valid RFC 5322 `From` header for Resend.
 *
 * `RESEND_FROM_EMAIL` may hold either a bare address (`alerts@example.com`) or an
 * already-formatted mailbox (`369 Systems Command <alerts@example.com>`). Nine call
 * sites across five routes unconditionally wrapped it in their own display name, which
 * produced a nested, invalid header:
 *
 *     369 Command Center <369 Systems Command <alerts@example.com>>
 *
 * Resend rejects that outright with "Invalid `from` field", so **every email from those
 * routes silently failed to send** — owner lead alerts, the Stripe post-payment
 * confirmation, and all five dossier emails. The failures were logged as warnings and
 * never surfaced, which is why it went unnoticed.
 *
 * This normalises both shapes: the address is extracted from whatever form the env var
 * takes, then re-labelled with the caller's display name.
 */
export function resendFrom(displayName: string): string {
  const raw = (process.env.RESEND_FROM_EMAIL ?? FALLBACK_FROM_ADDRESS).trim()

  // If the env var is already `Display Name <addr@host>`, take just the address.
  const mailbox = raw.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/)
  const address = (mailbox ? mailbox[1] : raw).trim()

  // A display name containing a quote or angle bracket would break the header; strip
  // rather than reject, since the caller controls it and a send is better than a throw.
  const safeName = displayName.replace(/["<>\\]/g, '').trim()

  return safeName ? `${safeName} <${address}>` : address
}

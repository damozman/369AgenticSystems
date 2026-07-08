// Single source of truth for who gets the admin Command Center vs the client dashboard.
export const ADMIN_EMAILS = ['chris@369agenticsystems.com']

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

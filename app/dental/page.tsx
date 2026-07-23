import { redirect } from 'next/navigation'

// Dental is waitlist-only — zero agents deployed, no Retell template configured.
// The self-serve intake/pricing funnel must not be reachable here; send visitors
// to the real waitlist page instead of presenting a live signup flow.
export default function Page() {
  redirect('/dental-leads/')
}

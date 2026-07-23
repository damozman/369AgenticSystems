import { redirect } from 'next/navigation'

// Dental is waitlist-only — this step of the self-serve funnel leads toward
// checkout, which must not be reachable for this vertical. Redirect to the
// waitlist page instead.
export default function Page() {
  redirect('/dental-leads/')
}

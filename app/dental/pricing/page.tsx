import { redirect } from 'next/navigation'

// Dental is waitlist-only — no live Stripe checkout should ever be reachable
// for this vertical (no Retell template configured, provisioning would fail
// after the customer has already been charged). Redirect to the waitlist.
export default function Page() {
  redirect('/dental-leads/')
}

import { redirect } from 'next/navigation'

// The rental niches have no Retell template agent of their own — TEMPLATE_AGENT_IDS
// in lib/retell-provisioning.ts has exactly nine keys, and `vertical` reaches it as
// Stripe's client_reference_id. A checkout from here would throw
// `No template agent configured` AFTER the customer had been charged, which is the
// same failure the dental funnel was fixed for. Until a rental vertical is
// deliberately mapped to a template, send buyers to a real conversation instead.
export default function Page() {
  redirect('/book-demo')
}

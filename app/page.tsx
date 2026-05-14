/*
  Root route for the Next.js app.

  Marketing site lives in /public (static HTML, served by CDN edge).
  This route redirects authenticated sessions to the portal and
  unauthenticated visitors to the login page.
  Middleware handles the /portal guard; this just avoids a blank root.
*/
import { redirect } from 'next/navigation'

export default function Root() {
  redirect('/login')
}

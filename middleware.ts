import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin'

// Admin Command Center routes — everything else under (portal) is client-dashboard,
// open to any authenticated user (its own page scopes data by the logged-in email).
const ADMIN_ONLY_PREFIXES = ['/dashboard', '/workforce', '/intelligence', '/history', '/receptionist']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh the session token if expired, and guard portal routes.
  const { data: { user } } = await supabase.auth.getUser()
  const pathname   = request.nextUrl.pathname
  const isAdminRoute = ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p))

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in but not an admin trying to reach an admin-only route (e.g. a real
  // client who guesses/bookmarks /dashboard) — send them to their own dashboard
  // instead of the internal Command Center.
  if (isAdminRoute && !isAdminEmail(user.email)) {
    return NextResponse.redirect(new URL('/client-dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/workforce/:path*', '/intelligence/:path*', '/history/:path*', '/receptionist/:path*', '/client-dashboard/:path*'],
}

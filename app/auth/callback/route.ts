import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // Build the redirect response FIRST so cookie handlers write directly onto
    // it. The previous pattern wrote to cookies() from next/headers, which is
    // a separate store — those cookies were never attached to the redirect
    // response the browser received, so the session was silently dropped.
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name)                 { return request.cookies.get(name)?.value },
          set(name, value, options) { response.cookies.set({ name, value, ...options }) },
          remove(name, options)     { response.cookies.set({ name, value: '', ...options }) },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return response
    }

    console.error('[369 AUTH] ✗  exchangeCodeForSession failed —', error.message)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

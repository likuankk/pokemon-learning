import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'pokemon_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const raw = request.cookies.get(SESSION_COOKIE)?.value

  let session: { id: number; name: string; role: 'parent' | 'child'; familyId: number } | null = null
  if (raw) {
    try {
      session = JSON.parse(raw)
    } catch {
      // Invalid cookie – treat as not logged in
    }
  }

  // ── Public routes: always accessible ──
  if (
    pathname === '/' ||
    pathname === '/auth' ||
    pathname === '/onboarding' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/onboarding') ||
    pathname.startsWith('/api/pokemon') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // ── Not logged in → redirect to auth ──
  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  // ── Role-based route protection ──
  if (pathname.startsWith('/child') && session.role !== 'child') {
    // Parent trying to access child pages → redirect to parent dashboard
    const url = request.nextUrl.clone()
    url.pathname = '/parent'
    return NextResponse.redirect(url)
  }

  // ── Onboarding guard for child users ──
  if (pathname.startsWith('/child') && session.role === 'child') {
    const onboardingDone = request.cookies.get('onboarding_completed')?.value
    if (!onboardingDone) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  if (pathname.startsWith('/parent') && session.role !== 'parent') {
    // Child trying to access parent pages → redirect to child dashboard
    const url = request.nextUrl.clone()
    url.pathname = '/child'
    return NextResponse.redirect(url)
  }

  // ── API route protection ──
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
    // API routes require a valid session
    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all routes except static files and images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

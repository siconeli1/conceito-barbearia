import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionCookie } from '@/lib/admin-session'

const PROTECTED_ADMIN_API_PREFIXES = [
  '/api/admin',
  '/api/admin-agenda',
  '/api/bloqueios',
  '/api/horarios-customizados',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value
  const isAuthenticated = await verifyAdminSessionCookie(sessionCookie)

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!isAuthenticated) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (
    PROTECTED_ADMIN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    pathname !== '/api/admin/login'
  ) {
    if (!isAuthenticated) {
      return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/admin-agenda',
    '/api/bloqueios/:path*',
    '/api/horarios-customizados',
  ],
}

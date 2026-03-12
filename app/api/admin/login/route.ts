import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookie,
} from '@/lib/admin-session'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export async function POST(req: NextRequest) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ erro: 'ADMIN_PASSWORD nao configurada' }, { status: 500 })
  }

  const { password } = await req.json()

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ erro: 'Senha incorreta' }, { status: 401 })
  }

  const token = await createAdminSessionCookie()
  const response = NextResponse.json({ ok: true })

  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: '/',
  })

  return response
}

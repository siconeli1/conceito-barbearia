import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123' // fallback para dev

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ erro: 'Senha incorreta' }, { status: 401 })
  }

  // gera um token simples (pode ser um UUID ou string aleatória)
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36)

  const response = NextResponse.json({ ok: true })

  // define cookie HTTP-only, secure, max-age 24h
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 horas
    path: '/',
  })

  return response
}
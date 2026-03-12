import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/admin-session"
import { getCustomerAccessCode, normalizePhone } from "@/lib/phone"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id } = body
    const celular = normalizePhone(body?.celular)
    const codigo = String(body?.codigo ?? "").trim().toUpperCase()

    if (!id) {
      return NextResponse.json(
        { erro: "ID nao informado" },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const adminCookie = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value
    const isAdmin = await verifyAdminSessionCookie(adminCookie)

    const { data: agendamento, error: loadError } = await supabase
      .from("agendamentos")
      .select("id, celular_cliente")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json(
        { erro: loadError.message },
        { status: 500 }
      )
    }

    if (!agendamento) {
      return NextResponse.json(
        { erro: "Agendamento nao encontrado" },
        { status: 404 }
      )
    }

    if (!isAdmin) {
      if (!celular || !codigo) {
        return NextResponse.json(
          { erro: "Celular e codigo de acesso sao obrigatorios" },
          { status: 401 }
        )
      }

      const codigoEsperado = await getCustomerAccessCode(celular)
      if (codigo !== codigoEsperado || normalizePhone(agendamento.celular_cliente) !== celular) {
        return NextResponse.json(
          { erro: "Nao autorizado a cancelar este agendamento" },
          { status: 403 }
        )
      }
    }

    const { error } = await supabase
      .from("agendamentos")
      .update({
        status: "cancelado",
        status_agendamento: "cancelado",
        cancelado_em: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { erro: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sucesso: true
    })

  } catch {
    return NextResponse.json(
      { erro: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

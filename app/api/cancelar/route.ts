import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/admin-session"
import { normalizePhone } from "@/lib/phone"
import { canCancelAppointment } from "@/lib/agendamento-rules"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id } = body
    const celular = normalizePhone(body?.celular)

    if (!id) {
      return NextResponse.json(
        { erro: "ID não informado" },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const adminCookie = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value
    const isAdmin = await verifyAdminSessionCookie(adminCookie)

    const { data: agendamento, error: loadError } = await supabase
      .from("agendamentos")
      .select("id, celular_cliente, data, hora_inicio, hora_fim, status, status_agendamento, status_atendimento, status_pagamento, origem_agendamento")
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
        { erro: "Agendamento não encontrado" },
        { status: 404 }
      )
    }

    if (!isAdmin) {
      if (!celular) {
        return NextResponse.json(
          { erro: "Celular obrigatório" },
          { status: 401 }
        )
      }

      if (normalizePhone(agendamento.celular_cliente) !== celular) {
        return NextResponse.json(
          { erro: "Não autorizado a cancelar este agendamento" },
          { status: 403 }
        )
      }
    }

    if (!canCancelAppointment(agendamento)) {
      return NextResponse.json(
        { erro: "Este agendamento não pode mais ser cancelado porque o horário já começou ou ele já foi finalizado." },
        { status: 409 }
      )
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

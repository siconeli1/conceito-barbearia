import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getBusyIntervals, overlaps, parseTimeToMinutes } from "@/lib/agenda-conflicts"
import { normalizePhone } from "@/lib/phone"

function getHorariosErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42P01") {
    return 'Tabela "horarios_customizados" nao encontrada. Execute a migracao de base.'
  }

  return error.message
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const data = searchParams.get("data")

    if (!data) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 })
    }

    const { data: horarios, error } = await supabase
      .from("horarios_customizados")
      .select("*")
      .eq("data", data)
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: getHorariosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json({ horarios: horarios || [] })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao listar horarios." },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { data, hora_inicio, hora_fim, nome_cliente, celular_cliente } = body

    if (!data || !hora_inicio || !hora_fim) {
      return NextResponse.json(
        { erro: "Data, hora de inicio e hora de fim sao obrigatorias." },
        { status: 400 }
      )
    }

    if (!nome_cliente) {
      return NextResponse.json(
        { erro: "Nome do cliente e obrigatorio." },
        { status: 400 }
      )
    }

    if (hora_inicio >= hora_fim) {
      return NextResponse.json(
        { erro: "Hora de fim deve ser apos hora de inicio." },
        { status: 400 }
      )
    }

    const inicio = parseTimeToMinutes(hora_inicio)
    const fim = parseTimeToMinutes(hora_fim)

    let busyState
    try {
      busyState = await getBusyIntervals(data)
    } catch (error) {
      return NextResponse.json(
        { erro: error instanceof Error ? error.message : "Erro ao validar conflitos." },
        { status: 500 }
      )
    }

    // Horario personalizado do admin ignora bloqueios e horario comercial.
    // Ele so nao pode colidir com outro atendimento ja existente.
    const temConflito = busyState.intervalos
      .filter((intervalo) => intervalo.tipo === "agendamento" || intervalo.tipo === "horario_customizado")
      .some((intervalo) => overlaps(inicio, fim, intervalo.inicio, intervalo.fim))

    if (temConflito) {
      return NextResponse.json(
        { erro: "Existe conflito com outro agendamento ou horario personalizado." },
        { status: 409 }
      )
    }

    const { data: horario, error } = await supabase
      .from("horarios_customizados")
      .insert([{
        data,
        hora_inicio,
        hora_fim,
        nome_cliente,
        celular_cliente: normalizePhone(celular_cliente) || null,
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { erro: getHorariosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json(horario)
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao criar horario." },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ erro: "ID do horario obrigatorio." }, { status: 400 })
    }

    const { error } = await supabase
      .from("horarios_customizados")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { erro: getHorariosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao deletar horario." },
      { status: 500 }
    )
  }
}

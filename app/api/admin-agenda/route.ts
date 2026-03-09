import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

function getAgendaErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42P01") {
    return 'Tabela "agendamentos" nao encontrada no Supabase.'
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

    // Busca agendamentos normais
    const { data: agendamentos, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("data", data)
      .in("status", ["agendado", "ativo"])
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: getAgendaErrorMessage(error) },
        { status: 500 }
      )
    }

    // Busca horários customizados (agendamentos manuais do barbeiro)
    const { data: horariosCustomizados, error: errorCustom } = await supabase
      .from("horarios_customizados")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente")
      .eq("data", data)
      .order("hora_inicio", { ascending: true })

    if (errorCustom) {
      console.error('Erro ao buscar horários customizados:', errorCustom)
      // Continua sem os horários customizados em caso de erro
    }

    // Mescla os dois arrays transformando os horários customizados no formato de agendamentos
    const todosAgendamentos = [
      ...(agendamentos || []),
      ...(horariosCustomizados || []).map(hc => ({
        id: hc.id,
        data: hc.data,
        hora_inicio: hc.hora_inicio,
        nome_cliente: hc.nome_cliente || 'Horário reservado',
        celular_cliente: hc.celular_cliente || '',
        status: 'ativo',
      }))
    ]

    // Ordena tudo por hora
    todosAgendamentos.sort((a, b) => {
      const aTime = String(a.hora_inicio).slice(0, 5)
      const bTime = String(b.hora_inicio).slice(0, 5)
      return aTime.localeCompare(bTime)
    })

    return NextResponse.json(todosAgendamentos)
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao carregar agenda." },
      { status: 500 }
    )
  }
}

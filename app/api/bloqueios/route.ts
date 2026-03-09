import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

function getBloqueiosErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42P01") {
    return 'Tabela "bloqueios_agenda" nao encontrada. Execute o SQL de criacao da tabela.'
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

    const { data: bloqueios, error } = await supabase
      .from("bloqueios_agenda")
      .select("*")
      .eq("data", data)
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: getBloqueiosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json({ bloqueios: bloqueios || [] })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao listar bloqueios." },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { data, hora_inicio, hora_fim, dia_inteiro, motivo, tipo_bloqueio } = body

    if (!data) {
      return NextResponse.json({ erro: "A data e obrigatoria." }, { status: 400 })
    }

    // Se está bloqueando dia inteiro, verificar se há agendamentos ativos
    if (tipo_bloqueio === 'dia_inteiro') {
      const { data: agendamentosAtivos, error: errorAgendamentos } = await supabase
        .from('agendamentos')
        .select('id, nome_cliente, celular_cliente, hora_inicio')
        .eq('data', data)
        .eq('status', 'ativo')

      if (errorAgendamentos) {
        return NextResponse.json(
          { erro: getBloqueiosErrorMessage(errorAgendamentos) },
          { status: 500 }
        )
      }

      if (agendamentosAtivos && agendamentosAtivos.length > 0) {
        return NextResponse.json({
          erro: `Não é possível bloquear o dia inteiro. Existem ${agendamentosAtivos.length} agendamento(s) ativo(s) nesta data. Entre em contato com os clientes para cancelar os horários antes de bloquear o dia.`,
          agendamentos: agendamentosAtivos
        }, { status: 400 })
      }
    }

    const { data: bloqueio, error } = await supabase
      .from("bloqueios_agenda")
      .insert([
        {
          data,
          hora_inicio: dia_inteiro ? null : hora_inicio || null,
          hora_fim: dia_inteiro ? null : hora_fim || null,
          dia_inteiro: !!dia_inteiro,
          motivo: motivo || null,
          tipo_bloqueio: tipo_bloqueio || 'horario',
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { erro: getBloqueiosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json(bloqueio)
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao criar bloqueio." },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ erro: "ID do bloqueio obrigatorio." }, { status: 400 })
    }

    const { error } = await supabase
      .from("bloqueios_agenda")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { erro: getBloqueiosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao deletar bloqueio." },
      { status: 500 }
    )
  }
}

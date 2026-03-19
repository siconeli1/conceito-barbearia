import { NextResponse } from "next/server"
import { overlaps, parseTimeToMinutes } from "@/lib/agenda-conflicts"
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

    if (tipo_bloqueio === "horario") {
      if (!hora_inicio || !hora_fim) {
        return NextResponse.json(
          { erro: "Hora de inicio e hora de fim sao obrigatorias para bloquear um horario especifico." },
          { status: 400 }
        )
      }

      if (hora_inicio >= hora_fim) {
        return NextResponse.json(
          { erro: "Hora de fim deve ser apos hora de inicio." },
          { status: 400 }
        )
      }
    }

    if (tipo_bloqueio === "dia_inteiro") {
      const [{ data: agendamentos, error: agendamentosError }, { data: horariosCustomizados, error: horariosError }] =
        await Promise.all([
          supabase
            .from("agendamentos")
            .select("id, nome_cliente, celular_cliente, hora_inicio, hora_fim, status, status_agendamento")
            .eq("data", data),
          supabase
            .from("horarios_customizados")
            .select("id, nome_cliente, celular_cliente, hora_inicio, hora_fim")
            .eq("data", data),
        ])

      if (agendamentosError) {
        return NextResponse.json(
          { erro: getBloqueiosErrorMessage(agendamentosError) },
          { status: 500 }
        )
      }

      if (horariosError) {
        return NextResponse.json(
          { erro: getBloqueiosErrorMessage(horariosError) },
          { status: 500 }
        )
      }

      const ocupacoesAtivas = [
        ...((agendamentos || [])
          .filter((agendamento) =>
            agendamento.status_agendamento
              ? agendamento.status_agendamento !== "cancelado"
              : agendamento.status === "ativo"
          )
          .map((agendamento) => ({
            id: agendamento.id,
            nome_cliente: agendamento.nome_cliente,
            celular_cliente: agendamento.celular_cliente,
            hora_inicio: agendamento.hora_inicio,
            hora_fim: agendamento.hora_fim,
            origem: "agendamento",
          }))),
        ...((horariosCustomizados || []).map((horario) => ({
          id: horario.id,
          nome_cliente: horario.nome_cliente,
          celular_cliente: horario.celular_cliente,
          hora_inicio: horario.hora_inicio,
          hora_fim: horario.hora_fim,
          origem: "horario_customizado",
        }))),
      ]

      if (ocupacoesAtivas.length > 0) {
        return NextResponse.json(
          {
            erro: `Nao e possivel bloquear o dia inteiro. Existem ${ocupacoesAtivas.length} horario(s) ocupado(s) nesta data. Cancele ou ajuste esses atendimentos antes de bloquear o dia.`,
            agendamentos: ocupacoesAtivas,
          },
          { status: 400 }
        )
      }
    }

    if (tipo_bloqueio === "horario") {
      const inicio = parseTimeToMinutes(hora_inicio)
      const fim = parseTimeToMinutes(hora_fim)

      const [{ data: agendamentos, error: agendamentosError }, { data: horariosCustomizados, error: horariosError }] =
        await Promise.all([
          supabase
            .from("agendamentos")
            .select("id, nome_cliente, celular_cliente, hora_inicio, hora_fim, status, status_agendamento")
            .eq("data", data),
          supabase
            .from("horarios_customizados")
            .select("id, nome_cliente, celular_cliente, hora_inicio, hora_fim")
            .eq("data", data),
        ])

      if (agendamentosError) {
        return NextResponse.json(
          { erro: getBloqueiosErrorMessage(agendamentosError) },
          { status: 500 }
        )
      }

      if (horariosError) {
        return NextResponse.json(
          { erro: getBloqueiosErrorMessage(horariosError) },
          { status: 500 }
        )
      }

      const conflitoAgendamento = (agendamentos || [])
        .filter((agendamento) =>
          agendamento.status_agendamento
            ? agendamento.status_agendamento !== "cancelado"
            : agendamento.status === "ativo"
        )
        .find((agendamento) =>
          overlaps(
            inicio,
            fim,
            parseTimeToMinutes(String(agendamento.hora_inicio)),
            parseTimeToMinutes(String(agendamento.hora_fim))
          )
        )

      if (conflitoAgendamento) {
        return NextResponse.json(
          {
            erro: "Nao e possivel bloquear este horario porque ele conflita com um agendamento existente.",
            conflito: conflitoAgendamento,
          },
          { status: 409 }
        )
      }

      const conflitoHorarioCustomizado = (horariosCustomizados || []).find((horario) =>
        overlaps(
          inicio,
          fim,
          parseTimeToMinutes(String(horario.hora_inicio)),
          parseTimeToMinutes(String(horario.hora_fim))
        )
      )

      if (conflitoHorarioCustomizado) {
        return NextResponse.json(
          {
            erro: "Nao e possivel bloquear este horario porque ele conflita com um horario personalizado ja reservado.",
            conflito: conflitoHorarioCustomizado,
          },
          { status: 409 }
        )
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
          tipo_bloqueio: tipo_bloqueio || "horario",
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

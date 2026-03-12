import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { calcularValorFinal, syncAutoClosedAgendamentos } from "@/lib/agendamento"

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
    const dateFrom = searchParams.get("date_from")
    const dateTo = searchParams.get("date_to")

    if (!data && !dateFrom) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 })
    }

    let agendamentoQuery = supabase
      .from("agendamentos")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, status, status_agendamento, status_atendimento, status_pagamento, valor_tabela, desconto, acrescimo, valor_final, forma_pagamento, origem_agendamento, observacoes, concluido_em, cancelado_em")
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true })

    let customQuery = supabase
      .from("horarios_customizados")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente")
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true })

    if (data) {
      agendamentoQuery = agendamentoQuery.eq("data", data)
      customQuery = customQuery.eq("data", data)
    } else {
      agendamentoQuery = agendamentoQuery.gte("data", dateFrom!).lte("data", dateTo || dateFrom!)
      customQuery = customQuery.gte("data", dateFrom!).lte("data", dateTo || dateFrom!)
    }

    const { data: agendamentosRaw, error } = await agendamentoQuery

    if (error) {
      return NextResponse.json(
        { erro: getAgendaErrorMessage(error) },
        { status: 500 }
      )
    }

    const agendamentos = await syncAutoClosedAgendamentos(agendamentosRaw || [])

    const { data: horariosCustomizados, error: errorCustom } = await customQuery

    if (errorCustom) {
      console.error("Erro ao buscar horarios customizados:", errorCustom)
    }

    const todosAgendamentos = [
      ...((agendamentos || []).map((agendamento) => ({
        ...agendamento,
        origem: "agendamento",
      })) ),
      ...(horariosCustomizados || []).map((hc) => ({
        id: hc.id,
        data: hc.data,
        hora_inicio: hc.hora_inicio,
        hora_fim: hc.hora_fim,
        nome_cliente: hc.nome_cliente || "Horario reservado",
        celular_cliente: hc.celular_cliente || "",
        servico_nome: "Horario personalizado",
        servico_preco: 0,
        status: "ativo",
        status_agendamento: "confirmado",
        status_atendimento: "concluido",
        status_pagamento: "pendente",
        valor_tabela: 0,
        desconto: 0,
        acrescimo: 0,
        valor_final: 0,
        forma_pagamento: null,
        origem_agendamento: "horario_customizado",
        observacoes: null,
        concluido_em: null,
        cancelado_em: null,
        origem: "horario_customizado",
      })),
    ]

    return NextResponse.json(todosAgendamentos)
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao carregar agenda." },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const {
      id,
      status_agendamento,
      status_atendimento,
      status_pagamento,
      desconto,
      acrescimo,
      valor_final,
      forma_pagamento,
      observacoes,
    } = body

    if (!id) {
      return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 })
    }

    const { data: atual, error: loadError } = await supabase
      .from("agendamentos")
      .select("id, valor_tabela, desconto, acrescimo")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json({ erro: loadError.message }, { status: 500 })
    }

    if (!atual) {
      return NextResponse.json({ erro: "Agendamento nao encontrado." }, { status: 404 })
    }

    const descontoFinal = normalizeMoneyField(desconto, atual.desconto)
    const acrescimoFinal = normalizeMoneyField(acrescimo, atual.acrescimo)
    const valorFinalCalculado =
      valor_final === undefined || valor_final === null || valor_final === ""
        ? calcularValorFinal({
            valorTabela: Number(atual.valor_tabela ?? 0),
            desconto: descontoFinal,
            acrescimo: acrescimoFinal,
          })
        : Number(valor_final)

    const patch: Record<string, string | number | null> = {
      desconto: descontoFinal,
      acrescimo: acrescimoFinal,
      valor_final: Math.max(0, valorFinalCalculado),
    }

    if (status_agendamento) {
      patch.status_agendamento = status_agendamento
      patch.status = status_agendamento === "cancelado" ? "cancelado" : "ativo"
      if (status_agendamento === "cancelado") {
        patch.cancelado_em = new Date().toISOString()
      }
    }

    if (status_atendimento) {
      patch.status_atendimento = status_atendimento
      if (status_atendimento === "concluido") {
        patch.concluido_em = new Date().toISOString()
      }
    }

    if (status_pagamento) {
      patch.status_pagamento = status_pagamento
    }

    if (forma_pagamento !== undefined) {
      patch.forma_pagamento = forma_pagamento || null
    }

    if (observacoes !== undefined) {
      patch.observacoes = observacoes || null
    }

    const { data: atualizado, error } = await supabase
      .from("agendamentos")
      .update(patch)
      .eq("id", id)
      .select("id, status, status_agendamento, status_atendimento, status_pagamento, desconto, acrescimo, valor_final, forma_pagamento, observacoes, concluido_em, cancelado_em")
      .single()

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, agendamento: atualizado })
  } catch {
    return NextResponse.json({ erro: "Erro interno ao atualizar agendamento." }, { status: 500 })
  }
}

function normalizeMoneyField(nextValue: unknown, currentValue: unknown) {
  if (nextValue === undefined || nextValue === null || nextValue === "") {
    return Number(currentValue ?? 0)
  }

  return Number(nextValue)
}

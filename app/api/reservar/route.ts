import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AGENDA_CONFIG, generateCandidateStartTimes, isAppointmentWithinSchedule, minutesToTime, timeToMinutes } from '@/lib/agenda'
import { calcularValorFinal } from '@/lib/agendamento'
import { getBusyIntervals } from '@/lib/agenda-conflicts'
import { isValidPhone, normalizePhone } from '@/lib/phone'
import { encontrarServicoAtivo } from '@/lib/servicos'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)

  const data = body?.data as string | undefined
  const hora_inicio = body?.hora_inicio as string | undefined
  const servicoId = body?.servico_id as string | undefined
  const servicoCodigo = body?.servico_codigo as string | undefined
  const nome_cliente = (body?.nome ?? '').trim()
  const celular_cliente = normalizePhone(body?.celular)

  if (!data || !hora_inicio || !nome_cliente || !celular_cliente || (!servicoId && !servicoCodigo)) {
    return NextResponse.json(
      { erro: 'Campos obrigatórios: data, hora_inicio, nome, celular, serviço' },
      { status: 400 }
    )
  }

  if (!isValidPhone(celular_cliente)) {
    return NextResponse.json({ erro: 'Celular inválido' }, { status: 400 })
  }

  const d = new Date(`${data}T00:00:00`)
  const day = d.getDay()

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return NextResponse.json({ erro: 'Data fora do funcionamento' }, { status: 400 })
  }

  const servico = await encontrarServicoAtivo({ id: servicoId, codigo: servicoCodigo })
  if (!servico) {
    return NextResponse.json({ erro: 'Serviço inválido ou inativo' }, { status: 400 })
  }

  const duracao = Number(servico.duracao_minutos)
  if (!Number.isFinite(duracao) || duracao <= 0) {
    return NextResponse.json({ erro: 'Duração do serviço inválida' }, { status: 400 })
  }

  const inicioReserva = timeToMinutes(hora_inicio)
  const fimReserva = inicioReserva + duracao

  if (!isAppointmentWithinSchedule(day, inicioReserva, duracao)) {
    return NextResponse.json(
      { erro: 'Não há tempo suficiente para este serviço nesse horário' },
      { status: 409 }
    )
  }

  let busyState
  try {
    busyState = await getBusyIntervals(data)
  } catch (error) {
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : 'Erro ao validar disponibilidade' },
      { status: 500 }
    )
  }

  if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
    return NextResponse.json({ erro: 'Data indisponível para agendamento' }, { status: 409 })
  }

  const horariosDisponiveis = new Set(generateCandidateStartTimes(day, duracao, busyState.intervalos))

  if (!horariosDisponiveis.has(inicioReserva)) {
    return NextResponse.json({ erro: 'Horário inválido para este serviço' }, { status: 409 })
  }

  const temConflito = busyState.intervalos.some(
    (intervalo) => inicioReserva < intervalo.fim && fimReserva > intervalo.inicio
  )

  if (temConflito) {
    return NextResponse.json({ erro: 'Horário indisponível para a duração do serviço' }, { status: 409 })
  }

  const valorTabela = Number(servico.preco ?? 0)
  const valorFinal = calcularValorFinal({ valorTabela })

  const { data: inserted, error } = await supabase
    .from('agendamentos')
    .insert({
      barbeiro_id: 'principal',
      data,
      hora_inicio,
      hora_fim: minutesToTime(fimReserva),
      nome_cliente,
      celular_cliente,
      servico_id: servico.db_id ?? null,
      servico_nome: servico.nome,
      servico_duracao_minutos: duracao,
      servico_preco: valorTabela,
      valor_tabela: valorTabela,
      desconto: 0,
      acrescimo: 0,
      valor_final: valorFinal,
      status: 'ativo',
      status_agendamento: 'agendado',
      status_atendimento: 'pendente',
      status_pagamento: 'pendente',
      origem_agendamento: 'site',
    })
    .select('id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_id, servico_nome, servico_duracao_minutos, servico_preco, valor_tabela, desconto, acrescimo, valor_final, status, status_agendamento, status_atendimento, status_pagamento')
    .single()

  if (error) {
    const msg = error.message?.toLowerCase?.() ?? ''
    if (
      msg.includes('duplicate') ||
      msg.includes('unique') ||
      msg.includes('exclusion') ||
      msg.includes('overlap')
    ) {
      return NextResponse.json({ erro: 'Horário já reservado para esse período' }, { status: 409 })
    }
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, agendamento: inserted })
}

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AGENDA_CONFIG, generateSlots, minutesToTime, timeToMinutes } from '@/lib/agenda'

function onlyDigits(s: string) {
  return (s ?? '').replace(/\D/g, '')
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = String(timeStr).slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)

  const data = body?.data as string | undefined
  const hora_inicio = body?.hora_inicio as string | undefined
  const servicoId = body?.servico_id as string | undefined
  const servicoCodigo = body?.servico_codigo as string | undefined
  const nome_cliente = (body?.nome ?? '').trim()
  const celular_cliente = onlyDigits(body?.celular ?? '')

  if (!data || !hora_inicio || !nome_cliente || !celular_cliente || (!servicoId && !servicoCodigo)) {
    return NextResponse.json(
      { erro: 'Campos obrigatórios: data, hora_inicio, nome, celular, serviço' },
      { status: 400 }
    )
  }

  if (celular_cliente.length < 10 || celular_cliente.length > 13) {
    return NextResponse.json({ erro: 'Celular inválido' }, { status: 400 })
  }

  // valida dia de funcionamento e se o slot faz parte dos horários
  // disponíveis para esse dia.
  const d = new Date(`${data}T00:00:00`)
  const day = d.getDay()

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return NextResponse.json({ erro: 'Data fora do funcionamento' }, { status: 400 })
  }

  const servicoQuery = supabase
    .from('servicos')
    .select('id, codigo, nome, duracao_minutos, preco, ativo')
    .eq('ativo', true)

  const { data: servicos, error: servicoError } = await (servicoId
    ? servicoQuery.eq('id', servicoId)
    : servicoQuery.eq('codigo', servicoCodigo!))

  if (servicoError) {
    return NextResponse.json({ erro: servicoError.message }, { status: 500 })
  }

  const servico = servicos?.[0]
  if (!servico) {
    return NextResponse.json({ erro: 'Serviço inválido ou inativo' }, { status: 400 })
  }

  const duracao = Number(servico.duracao_minutos)
  if (!Number.isFinite(duracao) || duracao <= 0) {
    return NextResponse.json({ erro: 'Duração do serviço inválida' }, { status: 400 })
  }

  // gera os slots para o dia solicitado e checa existência
  const slots = generateSlots(day)
  const slotInicial = slots.find((s) => s.hora_inicio === hora_inicio)
  if (!slotInicial) {
    return NextResponse.json({ erro: 'Horário inválido' }, { status: 400 })
  }

  const inicioAgenda = timeToMinutes(slots[0].hora_inicio)
  const fimAgenda = timeToMinutes(slots[slots.length - 1].hora_fim)
  const inicioReserva = timeToMinutes(hora_inicio)
  const fimReserva = inicioReserva + duracao

  if (inicioReserva < inicioAgenda || fimReserva > fimAgenda) {
    return NextResponse.json({ erro: 'Não há tempo suficiente para este serviço nesse horário' }, { status: 409 })
  }

  // Busca agendamentos e indisponibilidades para validar conflito da faixa completa.
  const [agendadosRes, customRes, bloqueiosRes] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('hora_inicio, hora_fim')
      .eq('data', data)
      .eq('status', 'ativo'),
    supabase
      .from('horarios_customizados')
      .select('hora_inicio, hora_fim')
      .eq('data', data),
    supabase
      .from('bloqueios_agenda')
      .select('hora_inicio, hora_fim, dia_inteiro, tipo_bloqueio')
      .eq('data', data),
  ])

  if (agendadosRes.error) {
    return NextResponse.json({ erro: agendadosRes.error.message }, { status: 500 })
  }

  if (customRes.error) {
    return NextResponse.json({ erro: customRes.error.message }, { status: 500 })
  }

  if (bloqueiosRes.error) {
    return NextResponse.json({ erro: bloqueiosRes.error.message }, { status: 500 })
  }

  const bloqueios = bloqueiosRes.data ?? []
  const bloqueioDiaInteiro = bloqueios.some((b) => b.dia_inteiro || b.tipo_bloqueio === 'dia_inteiro')
  const naoAceitarMais = bloqueios.some((b) => b.tipo_bloqueio === 'nao_aceitar_mais')

  if (bloqueioDiaInteiro || naoAceitarMais) {
    return NextResponse.json({ erro: 'Data indisponível para agendamento' }, { status: 409 })
  }

  const intervalosIndisponiveis = [
    ...(agendadosRes.data ?? []).map((a) => ({
      inicio: parseTimeToMinutes(String(a.hora_inicio)),
      fim: parseTimeToMinutes(String(a.hora_fim)),
    })),
    ...(customRes.data ?? []).map((h) => ({
      inicio: parseTimeToMinutes(String(h.hora_inicio)),
      fim: parseTimeToMinutes(String(h.hora_fim)),
    })),
    ...bloqueios
      .filter((b) => !b.dia_inteiro && b.tipo_bloqueio === 'horario' && b.hora_inicio && b.hora_fim)
      .map((b) => ({
        inicio: parseTimeToMinutes(String(b.hora_inicio)),
        fim: parseTimeToMinutes(String(b.hora_fim)),
      })),
  ]

  const temConflito = intervalosIndisponiveis.some((i) => overlaps(inicioReserva, fimReserva, i.inicio, i.fim))

  if (temConflito) {
    return NextResponse.json({ erro: 'Horário indisponível para a duração do serviço' }, { status: 409 })
  }

  // tenta inserir (a trava do banco e a validação acima impedem conflito)
  const { data: inserted, error } = await supabase
    .from('agendamentos')
    .insert({
      barbeiro_id: 'principal',
      data,
      hora_inicio,
      hora_fim: minutesToTime(fimReserva),
      nome_cliente,
      celular_cliente,
      servico_id: servico.id,
      servico_nome: servico.nome,
      servico_duracao_minutos: duracao,
      servico_preco: servico.preco,
      status: 'ativo',
    })
    .select('id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_id, servico_nome, servico_duracao_minutos, servico_preco, status')
    .single()

  if (error) {
    // conflito de intervalo/duplicidade é tratado como indisponível
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
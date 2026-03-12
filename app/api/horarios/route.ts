import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AGENDA_CONFIG, filterPastSlotsForDate, generateSlots, minutesToTime, timeToMinutes } from '@/lib/agenda'
import { getBusyIntervals, overlaps } from '@/lib/agenda-conflicts'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const data = searchParams.get('data')
  const servicoId = searchParams.get('servico_id')
  const servicoCodigo = searchParams.get('servico_codigo')

  if (!data) {
    return NextResponse.json({ erro: 'Informe ?data=YYYY-MM-DD' }, { status: 400 })
  }

  if (!servicoId && !servicoCodigo) {
    return NextResponse.json(
      { erro: 'Informe o servico em ?servico_id=... ou ?servico_codigo=...' },
      { status: 400 }
    )
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
    return NextResponse.json({ erro: 'Servico nao encontrado ou inativo' }, { status: 404 })
  }

  const duracao = Number(servico.duracao_minutos)
  if (!Number.isFinite(duracao) || duracao <= 0) {
    return NextResponse.json({ erro: 'Duracao do servico invalida' }, { status: 400 })
  }

  const d = new Date(`${data}T00:00:00`)
  const day = d.getDay()

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return NextResponse.json({ data, horarios: [] })
  }

  let busyState
  try {
    busyState = await getBusyIntervals(data)
  } catch (error) {
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : 'Erro ao carregar disponibilidade' },
      { status: 500 }
    )
  }

  const slots = filterPastSlotsForDate(data, generateSlots(day))

  if (slots.length === 0) {
    return NextResponse.json({ data, horarios: [], servico })
  }

  if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
    return NextResponse.json({ data, horarios: [], servico })
  }

  const inicioAgenda = timeToMinutes(slots[0].hora_inicio)
  const fimAgenda = timeToMinutes(slots[slots.length - 1].hora_fim)

  const horariosDisponiveis = slots
    .map((slot) => timeToMinutes(slot.hora_inicio))
    .filter((inicio) => {
      const fim = inicio + duracao

      if (inicio < inicioAgenda || fim > fimAgenda) {
        return false
      }

      return !busyState.intervalos.some((intervalo) => overlaps(inicio, fim, intervalo.inicio, intervalo.fim))
    })
    .map((inicio) => ({
      hora_inicio: minutesToTime(inicio),
      hora_fim: minutesToTime(inicio + duracao),
    }))

  return NextResponse.json({
    data,
    horarios: horariosDisponiveis,
    servico,
  })
}

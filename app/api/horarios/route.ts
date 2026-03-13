import { NextResponse } from 'next/server'
import { AGENDA_CONFIG, filterPastSlotsForDate, generateCandidateStartTimes, minutesToTime, reduceVisibleSlots, timeToMinutes } from '@/lib/agenda'
import { getBusyIntervals, overlaps } from '@/lib/agenda-conflicts'
import { encontrarServicoAtivo } from '@/lib/servicos'

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

  const servico = await encontrarServicoAtivo({ id: servicoId, codigo: servicoCodigo })
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

  if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
    return NextResponse.json({ data, horarios: [], servico })
  }

  const slots = filterPastSlotsForDate(
    data,
    generateCandidateStartTimes(day, duracao, busyState.intervalos).map((inicio) => ({
      hora_inicio: minutesToTime(inicio),
      hora_fim: minutesToTime(inicio + duracao),
    }))
  )

  if (slots.length === 0) {
    return NextResponse.json({ data, horarios: [], servico })
  }

  const horariosDisponiveis = reduceVisibleSlots(
    slots
    .map((slot) => ({
      ...slot,
      inicio: timeToMinutes(slot.hora_inicio),
      fim: timeToMinutes(slot.hora_fim),
    }))
    .filter((slot) => {
      return !busyState.intervalos.some((intervalo) => overlaps(slot.inicio, slot.fim, intervalo.inicio, intervalo.fim))
    })
    .map(({ hora_inicio, hora_fim }) => ({ hora_inicio, hora_fim }))
  )

  return NextResponse.json({
    data,
    horarios: horariosDisponiveis,
    servico,
  })
}

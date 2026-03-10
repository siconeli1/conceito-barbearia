import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AGENDA_CONFIG, generateSlots, minutesToTime, timeToMinutes } from '@/lib/agenda'

// Converte time string (HH:MM ou HH:MM:SS) para minutos desde meia-noite
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function overlaps(slotStart: number, slotEnd: number, busyStart: number, busyEnd: number): boolean {
  // Há sobreposição se: início do candidato é antes do fim ocupado
  // e fim do candidato é depois do início ocupado.
  return slotStart < busyEnd && slotEnd > busyStart
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const data = searchParams.get('data') // YYYY-MM-DD
  const servicoId = searchParams.get('servico_id')
  const servicoCodigo = searchParams.get('servico_codigo')

  if (!data) {
    return NextResponse.json({ erro: 'Informe ?data=YYYY-MM-DD' }, { status: 400 })
  }

  if (!servicoId && !servicoCodigo) {
    return NextResponse.json(
      { erro: 'Informe o serviço em ?servico_id=... ou ?servico_codigo=...' },
      { status: 400 }
    )
  }

  // Busca serviço ativo para obter duração usada no cálculo de disponibilidade.
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
    return NextResponse.json({ erro: 'Serviço não encontrado ou inativo' }, { status: 404 })
  }

  const duracao = Number(servico.duracao_minutos)
  if (!Number.isFinite(duracao) || duracao <= 0) {
    return NextResponse.json({ erro: 'Duração do serviço inválida' }, { status: 400 })
  }

  // Verifica dia da semana (0=dom ... 6=sáb)
  const d = new Date(`${data}T00:00:00`)
  const day = d.getDay()

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return NextResponse.json({ data, horarios: [] })
  }

  // Busca agendamentos ativos do dia.
  const { data: agendados, error } = await supabase
    .from('agendamentos')
    .select('hora_inicio, hora_fim')
    .eq('data', data)
    .eq('status', 'ativo')

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  // Busca horários customizados do barbeiro para este dia
  const { data: horariosCustomizados, error: errorCustom } = await supabase
    .from('horarios_customizados')
    .select('hora_inicio, hora_fim')
    .eq('data', data)

  if (errorCustom) {
    console.error('Erro ao buscar horários customizados:', errorCustom)
    // Continua sem horários customizados em caso de erro
  }

  // Busca bloqueios do dia
  const { data: bloqueios, error: errorBloqueios } = await supabase
    .from('bloqueios_agenda')
    .select('hora_inicio, hora_fim, dia_inteiro, tipo_bloqueio')
    .eq('data', data)

  if (errorBloqueios) {
    console.error('Erro ao buscar bloqueios:', errorBloqueios)
    // Continua sem bloqueios em caso de erro
  }

  // Processa agendamentos já existentes do dia.
  const intervalosAgendados = (agendados ?? []).map((a) => ({
    inicio: parseTimeToMinutes(String(a.hora_inicio)),
    fim: parseTimeToMinutes(String(a.hora_fim)),
  }))

  // Processa horários customizados do barbeiro.
  const intervalosCustomizados = (horariosCustomizados ?? []).map((hc) => ({
    inicio: parseTimeToMinutes(hc.hora_inicio),
    fim: parseTimeToMinutes(hc.hora_fim),
  }))

  // Processa bloqueios.
  const bloqueiosDia = (bloqueios ?? []).filter((b) => b.dia_inteiro || b.tipo_bloqueio === 'dia_inteiro')
  const bloqueiosHorario = (bloqueios ?? []).filter((b) => !b.dia_inteiro && b.tipo_bloqueio === 'horario')
  const naoAceitarMais = (bloqueios ?? []).some((b) => b.tipo_bloqueio === 'nao_aceitar_mais')

  const slots = generateSlots(day)

  if (slots.length === 0) {
    return NextResponse.json({
      data,
      horarios: [],
      servico,
    })
  }

  // Se há bloqueio de dia inteiro ou não aceitar mais, não há horários.
  if (bloqueiosDia.length > 0 || naoAceitarMais) {
    return NextResponse.json({ data, horarios: [], servico })
  }

  const intervaloBloqueios = bloqueiosHorario
    .filter((b) => b.hora_inicio && b.hora_fim)
    .map((b) => ({
      inicio: parseTimeToMinutes(String(b.hora_inicio)),
      fim: parseTimeToMinutes(String(b.hora_fim)),
    }))

  const intervalosIndisponiveis = [
    ...intervalosAgendados,
    ...intervalosCustomizados,
    ...intervaloBloqueios,
  ]

  const inicioAgenda = timeToMinutes(slots[0].hora_inicio)
  const fimAgenda = timeToMinutes(slots[slots.length - 1].hora_fim)

  // Horário inicial é válido somente se o serviço inteiro couber sem conflito.
  const horariosDisponiveis = slots
    .map((slot) => timeToMinutes(slot.hora_inicio))
    .filter((inicio) => {
      const fim = inicio + duracao

      if (inicio < inicioAgenda || fim > fimAgenda) {
        return false
      }

      return !intervalosIndisponiveis.some((i) => overlaps(inicio, fim, i.inicio, i.fim))
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
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AGENDA_CONFIG, generateSlots, timeToMinutes } from '@/lib/agenda'

// Converte time string (HH:MM ou HH:MM:SS) para minutos desde meia-noite
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// Verifica se um slot se sobrepõe com um horário customizado
function overlapsWithCustom(slotStart: number, slotEnd: number, customStart: number, customEnd: number): boolean {
  // Há sobreposição se: slot começa ANTES do fim do custom E slot termina DEPOIS do início do custom
  return slotStart < customEnd && slotEnd > customStart
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const data = searchParams.get('data') // YYYY-MM-DD

  if (!data) {
    return NextResponse.json({ erro: 'Informe ?data=YYYY-MM-DD' }, { status: 400 })
  }

  // Verifica dia da semana (0=dom ... 6=sáb)
  const d = new Date(`${data}T00:00:00`)
  const day = d.getDay()

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return NextResponse.json({ data, horarios: [] })
  }

  // Busca agendamentos ATIVOS do dia
  const { data: agendados, error } = await supabase
    .from('agendamentos')
    .select('hora_inicio')
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

  // Normaliza o formato retornado pelo Postgres (TIME geralmente vem como HH:MM:SS)
  // Ex.: "09:00:00" -> "09:00"
  const ocupados = new Set(
    (agendados ?? []).map((a: any) => String(a.hora_inicio).slice(0, 5))
  )

  // Processa horários customizados
  const hcustomizados = (horariosCustomizados ?? []).map(hc => ({
    inicio: parseTimeToMinutes(hc.hora_inicio),
    fim: parseTimeToMinutes(hc.hora_fim),
  }))

  // Processa bloqueios
  const bloqueiosDia = (bloqueios ?? []).filter(b => b.dia_inteiro || b.tipo_bloqueio === 'dia_inteiro')
  const bloqueiosHorario = (bloqueios ?? []).filter(b => !b.dia_inteiro && b.tipo_bloqueio === 'horario')
  const naoAceitarMais = (bloqueios ?? []).some(b => b.tipo_bloqueio === 'nao_aceitar_mais')

  const slots = generateSlots(day)

  // Se há bloqueio de dia inteiro, não retorna nenhum horário
  if (bloqueiosDia.length > 0) {
    return NextResponse.json({
      data,
      horarios: [],
    })
  }

  // Remove os horários ocupados E os que se sobrepõem com horários customizados ou bloqueios
  const horariosDisponiveis = slots.filter((s) => {
    const sInicio = timeToMinutes(s.hora_inicio)
    const sFim = timeToMinutes(s.hora_fim)

    // Se o slot está ocupado por agendamento, remove
    if (ocupados.has(s.hora_inicio)) {
      return false
    }

    // Se há bloqueio "não aceitar mais horários", remove slots vazios
    if (naoAceitarMais && !ocupados.has(s.hora_inicio)) {
      return false
    }

    // Se o slot se sobrepõe com algum horário customizado, remove
    if (hcustomizados.some(hc => overlapsWithCustom(sInicio, sFim, hc.inicio, hc.fim))) {
      return false
    }

    // Se o slot se sobrepõe com algum bloqueio de horário, remove
    if (bloqueiosHorario.some(b => {
      if (!b.hora_inicio || !b.hora_fim) return false
      const bInicio = parseTimeToMinutes(b.hora_inicio)
      const bFim = parseTimeToMinutes(b.hora_fim)
      return overlapsWithCustom(sInicio, sFim, bInicio, bFim)
    })) {
      return false
    }

    return true
  })

  return NextResponse.json({
    data,
    horarios: horariosDisponiveis,
  })
}
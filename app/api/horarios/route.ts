import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AGENDA_CONFIG, generateSlots } from '@/lib/agenda'

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

  // Normaliza o formato retornado pelo Postgres (TIME geralmente vem como HH:MM:SS)
  // Ex.: "09:00:00" -> "09:00"
  const ocupados = new Set(
    (agendados ?? []).map((a: any) => String(a.hora_inicio).slice(0, 5))
  )

  const slots = generateSlots()

  // Remove os horários ocupados
  const horariosDisponiveis = slots.filter((s) => !ocupados.has(s.hora_inicio))

  return NextResponse.json({
    data,
    horarios: horariosDisponiveis,
  })
}
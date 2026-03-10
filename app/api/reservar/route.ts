import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AGENDA_CONFIG, generateSlots } from '@/lib/agenda'

function onlyDigits(s: string) {
  return (s ?? '').replace(/\D/g, '')
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)

  const data = body?.data as string | undefined
  const hora_inicio = body?.hora_inicio as string | undefined
  const nome_cliente = (body?.nome ?? '').trim()
  const celular_cliente = onlyDigits(body?.celular ?? '')

  if (!data || !hora_inicio || !nome_cliente || !celular_cliente) {
    return NextResponse.json(
      { erro: 'Campos obrigatórios: data, hora_inicio, nome, celular' },
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

  // gera os slots para o dia solicitado e checa existência
  const slots = generateSlots(day)
  const slot = slots.find(s => s.hora_inicio === hora_inicio)
  if (!slot) {
    return NextResponse.json({ erro: 'Horário inválido' }, { status: 400 })
  }

  // tenta inserir (a trava do banco impede duplicidade)
  const { data: inserted, error } = await supabase
    .from('agendamentos')
    .insert({
      barbeiro_id: 'principal',
      data,
      hora_inicio: slot.hora_inicio,
      hora_fim: slot.hora_fim,
      nome_cliente,
      celular_cliente,
      status: 'ativo',
    })
    .select('id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, status')
    .single()

  if (error) {
    // quando for duplicidade, o banco vai acusar erro (unique constraint)
    const msg = error.message?.toLowerCase?.() ?? ''
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json({ erro: 'Horário já reservado' }, { status: 409 })
    }
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, agendamento: inserted })
}
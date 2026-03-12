import { supabase } from '@/lib/supabase'

export type StatusAgendamento = 'agendado' | 'confirmado' | 'cancelado' | 'no_show'
export type StatusAtendimento = 'pendente' | 'em_atendimento' | 'concluido'
export type StatusPagamento = 'pendente' | 'pago' | 'estornado'
export type OrigemAgendamento = 'site' | 'admin_manual' | 'horario_customizado'

type AutoCloseCandidate = {
  id: string
  data: string
  hora_fim: string
  status?: string | null
  status_agendamento?: StatusAgendamento | null
  status_atendimento?: StatusAtendimento | null
  status_pagamento?: StatusPagamento | null
  concluido_em?: string | null
}

export function calcularValorFinal({
  valorTabela,
  desconto = 0,
  acrescimo = 0,
}: {
  valorTabela: number
  desconto?: number
  acrescimo?: number
}) {
  return Math.max(0, Number(valorTabela) - Number(desconto) + Number(acrescimo))
}

export function isAgendamentoAtivo(statusLegado?: string, statusAgendamento?: string) {
  if (statusAgendamento) {
    return statusAgendamento !== 'cancelado'
  }

  return statusLegado === 'ativo'
}

export function isAgendamentoCancelado(statusLegado?: string, statusAgendamento?: string) {
  if (statusAgendamento) {
    return statusAgendamento === 'cancelado'
  }

  return statusLegado === 'cancelado'
}

function timeToMinutes(hora: string) {
  const [h, m] = String(hora).slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function getCurrentSaoPauloParts(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(referenceDate)
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  ) as Record<string, string>

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  }
}

export function shouldAutoCloseAgendamento(
  agendamento: AutoCloseCandidate,
  referenceDate = new Date()
) {
  if (
    agendamento.status === 'cancelado' ||
    agendamento.status_agendamento === 'cancelado' ||
    agendamento.status_agendamento === 'no_show'
  ) {
    return false
  }

  if (
    agendamento.status_atendimento === 'concluido' &&
    agendamento.status_pagamento === 'pago'
  ) {
    return false
  }

  const current = getCurrentSaoPauloParts(referenceDate)

  if (agendamento.data < current.date) {
    return true
  }

  if (agendamento.data > current.date) {
    return false
  }

  return timeToMinutes(agendamento.hora_fim) + 30 <= current.minutes
}

export async function syncAutoClosedAgendamentos<T extends AutoCloseCandidate>(
  agendamentos: T[],
  referenceDate = new Date()
) {
  const pending = agendamentos.filter((agendamento) =>
    shouldAutoCloseAgendamento(agendamento, referenceDate)
  )

  if (pending.length === 0) {
    return agendamentos
  }

  const updates = await Promise.all(
    pending.map(async (agendamento) => {
      const patch: Record<string, string> = {
        status: 'ativo',
        status_agendamento: 'confirmado',
        status_atendimento: 'concluido',
        status_pagamento: 'pago',
      }

      if (!agendamento.concluido_em) {
        patch.concluido_em = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('agendamentos')
        .update(patch)
        .eq('id', agendamento.id)
        .select('*')
        .single()

      if (error) {
        throw new Error(error.message)
      }

      return data as T
    })
  )

  const updatedById = new Map(updates.map((item) => [item.id, item]))
  return agendamentos.map((agendamento) => updatedById.get(agendamento.id) ?? agendamento)
}

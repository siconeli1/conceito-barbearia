import type { StatusAgendamento, StatusAtendimento, StatusPagamento } from "@/lib/agendamento"

type AgendamentoRuleCandidate = {
  data: string
  hora_inicio: string
  hora_fim: string
  status?: string | null
  status_agendamento?: StatusAgendamento | null
  status_atendimento?: StatusAtendimento | null
  status_pagamento?: StatusPagamento | null
  origem_agendamento?: string | null
}

function timeToMinutes(hora: string) {
  const [h, m] = String(hora).slice(0, 5).split(":").map(Number)
  return h * 60 + m
}

function getCurrentSaoPauloParts(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(referenceDate)
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  ) as Record<string, string>

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  }
}

export function hasAppointmentStarted(agendamento: Pick<AgendamentoRuleCandidate, "data" | "hora_inicio">, referenceDate = new Date()) {
  const current = getCurrentSaoPauloParts(referenceDate)

  if (agendamento.data < current.date) return true
  if (agendamento.data > current.date) return false
  return timeToMinutes(agendamento.hora_inicio) <= current.minutes
}

export function hasAppointmentEnded(agendamento: Pick<AgendamentoRuleCandidate, "data" | "hora_fim">, referenceDate = new Date()) {
  const current = getCurrentSaoPauloParts(referenceDate)

  if (agendamento.data < current.date) return true
  if (agendamento.data > current.date) return false
  return timeToMinutes(agendamento.hora_fim) <= current.minutes
}

export function canCancelAppointment(agendamento: AgendamentoRuleCandidate, referenceDate = new Date()) {
  if (agendamento.status === "cancelado" || agendamento.status_agendamento === "cancelado") return false
  if (agendamento.status_agendamento === "no_show") return false
  if (agendamento.status_atendimento === "concluido") return false
  if (hasAppointmentStarted(agendamento, referenceDate)) return false
  return true
}

export function canMarkNoShow(agendamento: AgendamentoRuleCandidate, referenceDate = new Date()) {
  if (agendamento.origem_agendamento === "horario_customizado") return false
  if (agendamento.status === "cancelado" || agendamento.status_agendamento === "cancelado") return false
  if (agendamento.status_agendamento === "no_show") return false
  if (agendamento.status_atendimento === "concluido") return false
  return hasAppointmentStarted(agendamento, referenceDate)
}

export function canConcludeAppointment(agendamento: AgendamentoRuleCandidate, referenceDate = new Date()) {
  if (agendamento.origem_agendamento === "horario_customizado") return false
  if (agendamento.status === "cancelado" || agendamento.status_agendamento === "cancelado") return false
  if (agendamento.status_agendamento === "no_show") return false
  if (agendamento.status_atendimento === "concluido") return false
  return hasAppointmentStarted(agendamento, referenceDate)
}

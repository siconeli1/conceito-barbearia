import { getLocalDateInputValue, isDateBeyondLimitInTimezone, isDateInPastInTimezone } from '@/lib/date'
import { formatPhone } from '@/lib/phone'

export type Slot = {
  hora_inicio: string
  hora_fim: string
}

export function formatarData(valor: string) {
  valor = valor.replace(/\D/g, "")

  if (valor.length > 8) valor = valor.slice(0, 8)

  if (valor.length > 4) {
    return `${valor.slice(0, 2)}/${valor.slice(2, 4)}/${valor.slice(4)}`
  }

  if (valor.length > 2) {
    return `${valor.slice(0, 2)}/${valor.slice(2)}`
  }

  return valor
}

export function formatarDataISO(valor: string) {
  if (!valor || !valor.includes("-")) {
    return valor
  }

  const [ano, mes, dia] = valor.split("-")

  if (!ano || !mes || !dia) {
    return valor
  }

  return `${dia}/${mes}/${ano}`
}

export function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

export function converterParaISO(data: string) {
  if (data.length !== 10) return null

  const [dia, mes, ano] = data.split("/")

  return `${ano}-${mes}-${dia}`
}

export function formatarCelular(valor: string) {
  return formatPhone(valor)
}

export function isDateInPast(iso: string) {
  return isDateInPastInTimezone(iso)
}

export function isDateBeyondLimit(iso: string, maxDays: number) {
  return isDateBeyondLimitInTimezone(iso, maxDays)
}

export function getTodayInputValue() {
  return getLocalDateInputValue()
}

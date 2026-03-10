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

// formata datas ISO do banco (YYYY-MM-DD) para DD/MM/YYYY
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

// simplifica hora no formato HH:MM ou HH:MM:SS para HH:MM
export function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

export function converterParaISO(data: string) {
  if (data.length !== 10) return null

  const [dia, mes, ano] = data.split("/")

  return `${ano}-${mes}-${dia}`
}

export function formatarCelular(valor: string) {
  valor = valor.replace(/\D/g, "")

  if (valor.length > 11) valor = valor.slice(0, 11)

  if (valor.length > 6) {
    return `(${valor.slice(0, 2)}) ${valor.slice(2, 7)}-${valor.slice(7)}`
  }

  if (valor.length > 2) {
    return `(${valor.slice(0, 2)}) ${valor.slice(2)}`
  }

  if (valor.length > 0) {
    return `(${valor}`
  }

  return valor
}

// returns true if the ISO-formatted date is strictly before today's date
export function isDateInPast(iso: string) {
  const today = new Date().toISOString().split("T")[0]
  return iso < today
}

// returns true if the ISO-formatted date is more than `maxDays` days after today
export function isDateBeyondLimit(iso: string, maxDays: number) {
  const today = new Date()
  const target = new Date(iso)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays > maxDays
}

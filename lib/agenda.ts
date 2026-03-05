// lib/agenda.ts

export const AGENDA_CONFIG = {
  timezone: 'America/Sao_Paulo',

  // dias que abre (0=domingo ... 6=sábado)
  openDays: [1, 2, 3, 4, 5, 6], // seg a sáb

  // horário de funcionamento
  startTime: '09:00',
  endTime: '19:00',

  // duração padrão do atendimento (em minutos)
  slotMinutes: 30,
}

// Helpers
export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(total: number) {
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function generateSlots() {
  const start = timeToMinutes(AGENDA_CONFIG.startTime)
  const end = timeToMinutes(AGENDA_CONFIG.endTime)
  const step = AGENDA_CONFIG.slotMinutes

  const slots: { hora_inicio: string; hora_fim: string }[] = []
  for (let t = start; t + step <= end; t += step) {
    slots.push({
      hora_inicio: minutesToTime(t),
      hora_fim: minutesToTime(t + step),
    })
  }
  return slots
}
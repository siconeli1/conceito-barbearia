// lib/agenda.ts

// configurações da agenda. usamos um mapa por dia da semana para
// permitir horários diferentes ao longo da semana.
// as chaves são números do dia (0=domingo, 6=sábado).
export const DAILY_SCHEDULE: Record<number, { start: string; end: string }> = {
  // terça a sexta das 09:00 às 20:00
  2: { start: '09:00', end: '20:00' },
  3: { start: '09:00', end: '20:00' },
  4: { start: '09:00', end: '20:00' },
  5: { start: '09:00', end: '20:00' },

  // sábado das 08:30 às 14:00
  6: { start: '08:30', end: '14:00' },
}

export const AGENDA_CONFIG = {
  timezone: 'America/Sao_Paulo',
  // dias que abre são as chaves definidas no mapa acima
  openDays: Object.keys(DAILY_SCHEDULE).map((d) => Number(d)),
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

export function generateSlots(day: number) {
  const schedule = DAILY_SCHEDULE[day]
  if (!schedule) {
    return []
  }

  const start = timeToMinutes(schedule.start)
  const end = timeToMinutes(schedule.end)
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

function getCurrentDateParts(referenceDate: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(referenceDate)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  }
}

export function filterPastSlotsForDate(
  date: string,
  slots: { hora_inicio: string; hora_fim: string }[],
  referenceDate = new Date(),
  timeZone = AGENDA_CONFIG.timezone
) {
  const current = getCurrentDateParts(referenceDate, timeZone)

  if (date !== current.date) {
    return slots
  }

  return slots.filter((slot) => timeToMinutes(slot.hora_inicio) > current.minutes)
}
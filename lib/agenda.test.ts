import { AGENDA_CONFIG, DAILY_SCHEDULE, filterPastSlotsForDate, generateCandidateStartTimes, generateSlots, reduceVisibleSlots } from './agenda'

describe('agenda scheduling', () => {
  test('daily schedule map contains correct keys', () => {
    expect(Object.keys(DAILY_SCHEDULE).sort()).toEqual(['1', '2', '3', '4', '5'])
    expect(AGENDA_CONFIG.openDays).toEqual([1, 2, 3, 4, 5])
  })

  test('generateSlots returns empty for non-working day', () => {
    expect(generateSlots(6, 40)).toEqual([])
  })

  test('weekdays have lunch break and last valid start at 19:00', () => {
    const slots = generateSlots(2, 40)

    expect(slots[0].hora_inicio).toBe('08:30')
    expect(slots.find((slot) => slot.hora_inicio === '12:00')).toBeUndefined()
    expect(slots.find((slot) => slot.hora_inicio === '14:00')).toBeDefined()

    const last = slots[slots.length - 1]
    expect(last.hora_inicio).toBe('19:00')
    expect(last.hora_fim).toBe('19:40')
  })

  test('60-minute service can finish exactly at 20:00', () => {
    const slots = generateSlots(3, 60)
    const last = slots[slots.length - 1]

    expect(last.hora_inicio).toBe('19:00')
    expect(last.hora_fim).toBe('20:00')
  })

  test('candidate starts include exact end of another atendimento', () => {
    const starts = generateCandidateStartTimes(2, 40, [{ inicio: 510, fim: 550 }])

    expect(starts).toContain(550)
  })

  test('visible slots show fewer options while keeping a fallback per bloco', () => {
    const visible = reduceVisibleSlots([
      { hora_inicio: '17:00', hora_fim: '17:40' },
      { hora_inicio: '17:10', hora_fim: '17:50' },
      { hora_inicio: '17:20', hora_fim: '18:00' },
      { hora_inicio: '17:30', hora_fim: '18:10' },
      { hora_inicio: '17:40', hora_fim: '18:20' },
      { hora_inicio: '18:10', hora_fim: '18:50' },
    ])

    expect(visible).toEqual([
      { hora_inicio: '17:00', hora_fim: '17:40' },
      { hora_inicio: '17:20', hora_fim: '18:00' },
      { hora_inicio: '17:40', hora_fim: '18:20' },
      { hora_inicio: '18:10', hora_fim: '18:50' },
    ])
  })

  test('filterPastSlotsForDate removes slots already passed for today', () => {
    const slots = [
      { hora_inicio: '16:30', hora_fim: '17:10' },
      { hora_inicio: '17:00', hora_fim: '17:40' },
      { hora_inicio: '17:30', hora_fim: '18:10' },
      { hora_inicio: '18:00', hora_fim: '18:40' },
    ]

    const filtered = filterPastSlotsForDate(
      '2026-03-10',
      slots,
      new Date('2026-03-10T20:00:00.000Z'),
      'America/Sao_Paulo'
    )

    expect(filtered).toEqual([
      { hora_inicio: '17:30', hora_fim: '18:10' },
      { hora_inicio: '18:00', hora_fim: '18:40' },
    ])
  })

  test('filterPastSlotsForDate keeps slots unchanged for other dates', () => {
    const slots = [
      { hora_inicio: '09:00', hora_fim: '09:40' },
      { hora_inicio: '09:10', hora_fim: '09:50' },
    ]

    const filtered = filterPastSlotsForDate(
      '2026-03-11',
      slots,
      new Date('2026-03-10T20:00:00.000Z'),
      'America/Sao_Paulo'
    )

    expect(filtered).toEqual(slots)
  })
})

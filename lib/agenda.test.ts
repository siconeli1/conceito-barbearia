import { AGENDA_CONFIG, DAILY_SCHEDULE, filterPastSlotsForDate, generateCandidateStartTimes, generateSlots, reduceVisibleSlots } from './agenda'

describe('agenda scheduling', () => {
  test('daily schedule map contains correct keys', () => {
    expect(Object.keys(DAILY_SCHEDULE).sort()).toEqual(['2', '3', '4', '5', '6'])
    expect(AGENDA_CONFIG.openDays).toEqual([2, 3, 4, 5, 6])
  })

  test('generateSlots returns empty for non-working day', () => {
    expect(generateSlots(1, 40)).toEqual([])
  })

  test('tuesday to friday have lunch break and start at 09:00', () => {
    const slots = generateSlots(2, 40)

    expect(slots[0].hora_inicio).toBe('09:00')
    expect(slots.find((slot) => slot.hora_inicio === '12:00')).toBeUndefined()
    expect(slots.find((slot) => slot.hora_inicio === '14:00')).toBeDefined()

    const last = slots[slots.length - 1]
    expect(last.hora_inicio).toBe('19:00')
    expect(last.hora_fim).toBe('19:40')
  })

  test('weekdays accept 19:00 as the last start regardless of service duration', () => {
    const slots = generateSlots(3, 60)
    const last = slots[slots.length - 1]

    expect(last.hora_inicio).toBe('19:00')
    expect(last.hora_fim).toBe('20:00')
  })

  test('saturday runs straight from 09:00 to 14:00 without lunch break', () => {
    const slots = generateSlots(6, 40)

    expect(slots[0].hora_inicio).toBe('09:00')
    expect(slots.find((slot) => slot.hora_inicio === '12:00')).toBeDefined()

    const last = slots[slots.length - 1]
    expect(last.hora_inicio).toBe('13:20')
    expect(last.hora_fim).toBe('14:00')
  })

  test('candidate starts include exact end of another atendimento', () => {
    const starts = generateCandidateStartTimes(2, 40, [{ inicio: 510, fim: 550 }])

    expect(starts).toContain(550)
  })

  test('19:00 remains available on weekdays for long services', () => {
    const starts = generateCandidateStartTimes(5, 60)

    expect(starts).toContain(1140)
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

import { generateSlots, DAILY_SCHEDULE, AGENDA_CONFIG, filterPastSlotsForDate } from './agenda'

describe('agenda scheduling', () => {
  test('daily schedule map contains correct keys', () => {
    // should only have entries for tue-fri (2-5) and sat (6)
    expect(Object.keys(DAILY_SCHEDULE).sort()).toEqual(['2', '3', '4', '5', '6'])
    expect(AGENDA_CONFIG.openDays).toEqual([2, 3, 4, 5, 6])
  })

  test('generateSlots returns empty for non-working day (e.g. Monday=1)', () => {
    expect(generateSlots(1)).toEqual([])
  })

  test('weekdays have 09:00-20:00 slots of 30min', () => {
    const slots = generateSlots(2) // terça
    expect(slots[0].hora_inicio).toBe('09:00')
    // last slot should end at 20:00
    const last = slots[slots.length - 1]
    expect(last.hora_fim).toBe('20:00')
  })

  test('saturday slots start at 08:30 and end at 14:00', () => {
    const slots = generateSlots(6)
    expect(slots[0].hora_inicio).toBe('08:30')
    expect(slots[slots.length - 1].hora_fim).toBe('14:00')
  })

  test('filterPastSlotsForDate removes slots already passed for today', () => {
    const slots = [
      { hora_inicio: '16:30', hora_fim: '17:00' },
      { hora_inicio: '17:00', hora_fim: '17:30' },
      { hora_inicio: '17:30', hora_fim: '18:00' },
      { hora_inicio: '18:00', hora_fim: '18:30' },
    ]

    const filtered = filterPastSlotsForDate(
      '2026-03-10',
      slots,
      new Date('2026-03-10T20:00:00.000Z'),
      'America/Sao_Paulo'
    )

    expect(filtered).toEqual([
      { hora_inicio: '17:30', hora_fim: '18:00' },
      { hora_inicio: '18:00', hora_fim: '18:30' },
    ])
  })

  test('filterPastSlotsForDate keeps slots unchanged for other dates', () => {
    const slots = [
      { hora_inicio: '09:00', hora_fim: '09:30' },
      { hora_inicio: '09:30', hora_fim: '10:00' },
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

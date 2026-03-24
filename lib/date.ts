const DEFAULT_TIMEZONE = 'America/Sao_Paulo'
export const MAX_BOOKING_BUSINESS_DAYS = 15

function getDateFormatter(timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isBusinessDay(date: Date) {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

export function getLocalDateInputValue(referenceDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getDateFormatter(timeZone).formatToParts(referenceDate)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>

  return `${values.year}-${values.month}-${values.day}`
}

export function isDateInPastInTimezone(iso: string, timeZone = DEFAULT_TIMEZONE) {
  return iso < getLocalDateInputValue(new Date(), timeZone)
}

export function isDateBeyondLimitInTimezone(iso: string, maxDays: number, timeZone = DEFAULT_TIMEZONE) {
  const todayIso = getLocalDateInputValue(new Date(), timeZone)
  const today = parseIsoDate(todayIso)
  const target = parseIsoDate(iso)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays > maxDays
}

export function addBusinessDaysToInputValue(iso: string, businessDays: number) {
  const date = parseIsoDate(iso)
  let added = 0

  while (added < businessDays) {
    date.setDate(date.getDate() + 1)
    if (isBusinessDay(date)) {
      added += 1
    }
  }

  return formatIsoDate(date)
}

export function getMaxBusinessDateInputValue(businessDays: number, referenceDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const todayIso = getLocalDateInputValue(referenceDate, timeZone)
  return addBusinessDaysToInputValue(todayIso, businessDays)
}

export function isDateBeyondBusinessLimitInTimezone(iso: string, maxBusinessDays: number, timeZone = DEFAULT_TIMEZONE) {
  const todayIso = getLocalDateInputValue(new Date(), timeZone)
  const today = parseIsoDate(todayIso)
  const target = parseIsoDate(iso)

  if (target.getTime() <= today.getTime()) {
    return false
  }

  const cursor = new Date(today)
  let countedBusinessDays = 0

  while (cursor.getTime() < target.getTime()) {
    cursor.setDate(cursor.getDate() + 1)
    if (isBusinessDay(cursor)) {
      countedBusinessDays += 1
      if (countedBusinessDays > maxBusinessDays) {
        return true
      }
    }
  }

  return false
}

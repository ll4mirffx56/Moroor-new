import { isValidJalaaliDate, jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js'

/**
 * All persisted calendar values are Gregorian ISO days (`YYYY-MM-DD`).
 * Jalali values are used only for display and date picking. Gregorian years are
 * never rendered with locale grouping, so a Jalali year like 1405 can never
 * become "1,405".
 */
export type JalaliParts = { jy: number; jm: number; jd: number }
export type CalendarCell = { iso: string; jy: number; jm: number; jd: number; inMonth: boolean; weekday: number }

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const

/** Saturday-first weekday labels, matching the Persian calendar grid. */
export const PERSIAN_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const
export const PERSIAN_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, digit => FA_DIGITS[Number(digit)])
}

export function toLatinDigits(value: string): string {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(FA_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(AR_DIGITS.indexOf(digit)))
    .replace(/[٫]/g, '.')
    .replace(/[٬،,\u066C]/g, '')
    .replace(/\u200c/g, '')
    .trim()
}

/** Persian-formatted number with grouping. Never use this for date parts. */
export function faNumber(value: number, maxFractionDigits = 1, minFractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—'
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.max(0, Math.min(6, maxFractionDigits)),
    minimumFractionDigits: Math.max(0, Math.min(6, minFractionDigits)),
    useGrouping: true,
  }).format(value)
  return toPersianDigits(formatted).replace(/,/g, '٬').replace(/\./g, '٫').replace(/-/g, '−')
}

/** Year (or any identifier) without thousands separators: ۱۴۰۵, never ۱٬۴۰۵. */
export function faYear(value: number): string {
  return toPersianDigits(String(Math.trunc(value)))
}

export function pad2Fa(value: number): string {
  return toPersianDigits(String(Math.trunc(value)).padStart(2, '0'))
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${faNumber(value, digits)}٪`
}

export function formatHours(value: number): string {
  return `${faNumber(value, 1)} ساعت`
}

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(Number.isFinite(totalMinutes) ? totalMinutes : 0))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${faNumber(rest, 0)} دقیقه`
  if (rest <= 0) return `${faNumber(hours, 0)} ساعت`
  return `${faNumber(hours, 0)} ساعت و ${faNumber(rest, 0)} دقیقه`
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1900 || year > 2200) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
}

export function parseISODate(iso: string): { gy: number; gm: number; gd: number } | null {
  if (!isValidISODate(iso)) return null
  const [gy, gm, gd] = iso.split('-').map(Number)
  return { gy, gm, gd }
}

/** Calendar-safe day arithmetic on UTC boundaries; time zones cannot shift the day. */
export function addDaysISO(iso: string, days: number): string {
  const parts = parseISODate(iso)
  if (!parts || !Number.isInteger(days)) throw new RangeError('Invalid ISO date or day offset')
  const date = new Date(Date.UTC(parts.gy, parts.gm - 1, parts.gd + days))
  return toISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function toISODate(gy: number, gm: number, gd: number): string {
  return `${String(gy).padStart(4, '0')}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
}

/** Positive when `a` is after `b`. */
export function diffDaysISO(a: string, b: string): number {
  const left = parseISODate(a)
  const right = parseISODate(b)
  if (!left || !right) throw new RangeError('Invalid ISO date')
  return Math.round((Date.UTC(left.gy, left.gm - 1, left.gd) - Date.UTC(right.gy, right.gm - 1, right.gd)) / 86400000)
}

export function isoToJalaliParts(iso: string): JalaliParts | null {
  const parts = parseISODate(iso)
  if (!parts) return null
  try {
    const result = toJalaali(parts.gy, parts.gm, parts.gd)
    return isValidJalaaliDate(result.jy, result.jm, result.jd) ? result : null
  } catch {
    return null
  }
}

export function jalaliToISO(jy: number, jm: number, jd: number): string | null {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return null
  if (jy < 1200 || jy > 1700 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null
  try {
    if (!isValidJalaaliDate(jy, jm, jd)) return null
    const gregorian = toGregorian(jy, jm, jd)
    const iso = toISODate(gregorian.gy, gregorian.gm, gregorian.gd)
    const roundTrip = isoToJalaliParts(iso)
    if (!roundTrip || roundTrip.jy !== jy || roundTrip.jm !== jm || roundTrip.jd !== jd) return null
    return iso
  } catch {
    return null
  }
}

export type JalaliStyle = 'short' | 'long' | 'dayMonth' | 'monthYear' | 'full'

export function formatJalali(iso: string | null | undefined, style: JalaliStyle = 'short'): string {
  if (!iso) return '—'
  const parts = isoToJalaliParts(iso)
  if (!parts) return '—'
  const { jy, jm, jd } = parts
  switch (style) {
    case 'short':
      return `${faYear(jy)}/${pad2Fa(jm)}/${pad2Fa(jd)}`
    case 'long':
      return `${pad2Fa(jd)} ${PERSIAN_MONTHS[jm - 1]} ${faYear(jy)}`
    case 'dayMonth':
      return `${faNumber(jd, 0)} ${PERSIAN_MONTHS[jm - 1]}`
    case 'monthYear':
      return `${PERSIAN_MONTHS[jm - 1]} ${faYear(jy)}`
    case 'full':
      return `${PERSIAN_WEEKDAYS[weekdayIndex(iso)]} ${pad2Fa(jd)} ${PERSIAN_MONTHS[jm - 1]} ${faYear(jy)}`
  }
}

export function isoToJalaliInput(iso: string): string {
  const parts = isoToJalaliParts(iso)
  if (!parts) return ''
  return `${faYear(parts.jy)}/${pad2Fa(parts.jm)}/${pad2Fa(parts.jd)}`
}

/** Parses typed Jalali text. Returns null instead of a wrong date. */
export function parseJalaliInput(value: string): string | null {
  const text = toLatinDigits(value)
  const match = /^(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})$/.exec(text)
  if (!match) return null
  return jalaliToISO(Number(match[1]), Number(match[2]), Number(match[3]))
}

/** 0 = Saturday … 6 = Friday, for the given ISO date. */
export function weekdayIndex(iso: string): number {
  const parts = parseISODate(iso)
  if (!parts) return 0
  return (new Date(Date.UTC(parts.gy, parts.gm - 1, parts.gd)).getUTCDay() + 1) % 7
}

export function startOfWeekISO(iso: string): string {
  return addDaysISO(iso, -weekdayIndex(iso))
}

export function endOfWeekISO(iso: string): string {
  return addDaysISO(startOfWeekISO(iso), 6)
}

export function jalaliMonthRangeISO(iso: string): { start: string; end: string } | null {
  const parts = isoToJalaliParts(iso)
  if (!parts) return null
  const start = jalaliToISO(parts.jy, parts.jm, 1)
  const end = jalaliToISO(parts.jy, parts.jm, jalaaliMonthLength(parts.jy, parts.jm))
  return start && end ? { start, end } : null
}

export function jalaliMonthMatrix(jy: number, jm: number): CalendarCell[] {
  const length = jalaaliMonthLength(jy, jm)
  const firstISO = jalaliToISO(jy, jm, 1)
  if (!firstISO) return []
  const offset = weekdayIndex(firstISO)
  const totalCells = Math.ceil((offset + length) / 7) * 7
  const cells: CalendarCell[] = []
  for (let index = 0; index < totalCells; index += 1) {
    const iso = addDaysISO(firstISO, index - offset)
    const parts = isoToJalaliParts(iso)
    if (!parts) continue
    cells.push({
      iso,
      jy: parts.jy,
      jm: parts.jm,
      jd: parts.jd,
      inMonth: parts.jy === jy && parts.jm === jm,
      weekday: index % 7,
    })
  }
  return cells
}

export function shiftJalaliMonth(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  const total = jy * 12 + (jm - 1) + delta
  return { jy: Math.floor(total / 12), jm: (total % 12 + 12) % 12 + 1 }
}

export function todayISOInTehran(date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date)
    const find = (type: string) => parts.find(part => part.type === type)?.value
    const year = find('year'), month = find('month'), day = find('day')
    if (year && month && day) {
      const iso = `${year}-${month}-${day}`
      if (isValidISODate(iso)) return iso
    }
  } catch {
    /* fall through to local time */
  }
  return localTodayISO(date)
}

export function localTodayISO(date = new Date()): string {
  return toISODate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function serverTodayISO(header: string | null): string | null {
  if (!header) return null
  const date = new Date(header)
  if (Number.isNaN(date.getTime())) return null
  return todayISOInTehran(date)
}

export function tehranTimeLabel(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date)
  }
}

export function relativeDayLabel(iso: string, today: string): string {
  let distance = 0
  try {
    distance = diffDaysISO(iso, today)
  } catch {
    return '—'
  }
  if (distance === 0) return 'امروز'
  if (distance === 1) return 'فردا'
  if (distance === -1) return 'دیروز'
  if (distance > 1) return `${faNumber(distance, 0)} روز دیگر`
  return `${faNumber(Math.abs(distance), 0)} روز پیش`
}

/** Strict non-negative integer parsing for form fields. Empty → null. */
export function parseIntegerInput(value: string): number | null {
  const text = toLatinDigits(value)
  if (!text) return null
  if (!/^\d+$/.test(text)) return null
  const parsed = Number(text)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function parseDecimalInput(value: string): number | null {
  const text = toLatinDigits(value)
  if (!text) return null
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

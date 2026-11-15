/**
 * Test and exam arithmetic. Every percentage in the product comes from here so
 * the UI, the reports and the exports always agree.
 *
 * Negative marking: ((correct × 3) − wrong) / (total × 3) × 100
 * Unanswered questions score zero. A total of zero returns null (no division).
 */
export type TestCounts = { total: number; correct: number; wrong: number }

export const MAX_QUESTIONS_PER_RECORD = 10000
export const NEGATIVE_MARK_FACTOR = 3

export function isEmptyCounts(counts: TestCounts): boolean {
  return counts.total === 0 && counts.correct === 0 && counts.wrong === 0
}

export function unanswered(counts: TestCounts): number {
  return counts.total - counts.correct - counts.wrong
}

/** Returns a Persian error message, or null when the counts are valid. */
export function validateCounts(counts: TestCounts, options: { allowZeroTotal?: boolean } = {}): string | null {
  const values = [counts.total, counts.correct, counts.wrong]
  if (values.some(value => !Number.isInteger(value))) return 'تعداد سؤال‌ها باید عدد صحیح باشد.'
  if (values.some(value => value < 0)) return 'تعداد سؤال‌ها نمی‌تواند منفی باشد.'
  if (counts.total > MAX_QUESTIONS_PER_RECORD) return 'تعداد سؤال‌ها از حد مجاز بیشتر است.'
  if (counts.total === 0 && !options.allowZeroTotal) return 'تعداد کل سؤال‌ها باید بیشتر از صفر باشد.'
  if (counts.correct > counts.total) return 'تعداد پاسخ صحیح نمی‌تواند از تعداد کل بیشتر باشد.'
  if (counts.correct + counts.wrong > counts.total) {
    return 'مجموع صحیح و غلط از تعداد کل بیشتر است؛ اختلاف صحیح و غلط با کل، تعداد نزده است.'
  }
  return null
}

export function isCountsValid(counts: TestCounts, options: { allowZeroTotal?: boolean } = {}): boolean {
  return validateCounts(counts, options) === null
}

export function examPercent(counts: TestCounts): number | null {
  if (!Number.isFinite(counts.total) || counts.total <= 0) return null
  if (validateCounts(counts) !== null) return null
  return ((counts.correct * NEGATIVE_MARK_FACTOR - counts.wrong) / (counts.total * NEGATIVE_MARK_FACTOR)) * 100
}

export function totalQuestions(records: TestCounts[]): number {
  return records.reduce((sum, record) => sum + Math.max(0, record.total), 0)
}

/** Overall percentage uses summed answers, never the mean of per-subject percentages. */
export function aggregateCounts(records: TestCounts[]): TestCounts {
  return records.reduce<TestCounts>((sum, record) => ({
    total: sum.total + record.total,
    correct: sum.correct + record.correct,
    wrong: sum.wrong + record.wrong,
  }), { total: 0, correct: 0, wrong: 0 })
}

export function aggregatePercent(records: TestCounts[]): number | null {
  return examPercent(aggregateCounts(records))
}

export function averagePercent(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

export function percentTone(value: number | null): 'positive' | 'neutral' | 'negative' | 'none' {
  if (value === null || !Number.isFinite(value)) return 'none'
  if (value >= 60) return 'positive'
  if (value >= 35) return 'neutral'
  return 'negative'
}

export function trendOf(values: Array<number | null>): { delta: number | null; direction: 'up' | 'down' | 'flat' | 'none' } {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (usable.length < 2) return { delta: null, direction: 'none' }
  const half = Math.ceil(usable.length / 2)
  const first = usable.slice(0, half)
  const last = usable.slice(half)
  const firstAverage = first.reduce((sum, value) => sum + value, 0) / first.length
  const lastAverage = last.reduce((sum, value) => sum + value, 0) / last.length
  const delta = lastAverage - firstAverage
  if (Math.abs(delta) < 0.5) return { delta, direction: 'flat' }
  return { delta, direction: delta > 0 ? 'up' : 'down' }
}

export function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

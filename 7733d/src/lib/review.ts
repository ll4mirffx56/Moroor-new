import { addDaysISO, diffDaysISO, isValidISODate } from './date.js'

export type Mastery = 'weak' | 'medium' | 'good' | 'excellent'
export type ReviewStatus = 'pending' | 'completed' | 'overdue' | 'rescheduled'
export type ReviewType = 'scheduled' | 'manual'

export const MASTERY_LEVELS: Mastery[] = ['weak', 'medium', 'good', 'excellent']

export const MASTERY_LABELS: Record<Mastery, string> = {
  weak: 'ضعیف',
  medium: 'متوسط',
  good: 'خوب',
  excellent: 'عالی',
}

export const MASTERY_HINTS: Record<Mastery, string> = {
  weak: 'نیاز به مرور زودهنگام',
  medium: 'در حال تثبیت',
  good: 'تسلط قابل قبول',
  excellent: 'تسلط پایدار',
}

/** Editable through settings; values are validated on load. */
export const DEFAULT_MASTERY_INTERVALS: Record<Mastery, number> = {
  weak: 1,
  medium: 2,
  good: 4,
  excellent: 7,
}

export const MAX_INTERVAL_DAYS = 180
export const MIN_INTERVAL_DAYS = 1

export function isValidMastery(value: unknown): value is Mastery {
  return typeof value === 'string' && (MASTERY_LEVELS as string[]).includes(value)
}

export function masteryRank(mastery: Mastery): number {
  return MASTERY_LEVELS.indexOf(mastery)
}

export function isValidMasteryIntervals(value: unknown): value is Record<Mastery, number> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Record<Mastery, unknown>>
  return MASTERY_LEVELS.every(level => {
    const interval = candidate[level]
    return typeof interval === 'number' && Number.isInteger(interval) && interval >= MIN_INTERVAL_DAYS && interval <= MAX_INTERVAL_DAYS
  })
}

/** Next review date for a mastery answer, based on the adjustable intervals. */
export function nextReviewDate(baseISO: string, mastery: Mastery, intervals: Record<Mastery, number>): string {
  if (!isValidISODate(baseISO)) throw new RangeError('Invalid base date')
  if (!isValidMastery(mastery)) throw new RangeError('Invalid mastery level')
  if (!isValidMasteryIntervals(intervals)) throw new RangeError('Invalid mastery intervals')
  return addDaysISO(baseISO, intervals[mastery])
}

export type ReviewLike = {
  dueDate: string
  status: ReviewStatus
  completedOn?: string | null
  rescheduledTo?: string | null
}

/** Overdue is derived, never stored: a pending review becomes overdue by date alone. */
export function resolveReviewStatus(review: ReviewLike, today: string): ReviewStatus {
  if (review.status === 'completed') return 'completed'
  // A rescheduled review is still actionable: it is overdue when its new date has
  // passed, otherwise it is pending. The rescheduled marker is shown separately.
  return diffDaysISO(review.dueDate, today) < 0 ? 'overdue' : 'pending'
}

export function reviewDayOffset(dueDate: string, today: string): number {
  return diffDaysISO(dueDate, today)
}

export type ReviewCounts = { today: number; overdue: number; upcoming: number; completed: number }

export function countReviews(reviews: ReviewLike[], today: string): ReviewCounts {
  const counts: ReviewCounts = { today: 0, overdue: 0, upcoming: 0, completed: 0 }
  for (const review of reviews) {
    const status = resolveReviewStatus(review, today)
    if (status === 'completed') {
      counts.completed += 1
      continue
    }
    const offset = reviewDayOffset(review.dueDate, today)
    if (offset < 0) counts.overdue += 1
    else if (offset === 0) counts.today += 1
    else counts.upcoming += 1
  }
  return counts
}

export type ReviewWithId = ReviewLike & {
  id: string
  subjectName: string
  chapterName?: string
  topicName?: string
  mastery?: Mastery
  firstStudiedOn?: string
  completedOn?: string | null
}

export type TopicReviewSummary = {
  key: string
  subjectName: string
  topicName: string
  totalReviews: number
  completedReviews: number
  lastCompletedOn: string | null
  nextDueDate: string | null
  mastery: Mastery | null
  overdue: number
}

/**
 * Per-topic review statistics: count, last completion, next due date, current
 * mastery and punctuality. Topic identity is `${subjectName}::${chapterName}::${topicName}`.
 */
export function summarizeTopics(reviews: ReviewWithId[], today: string): TopicReviewSummary[] {
  const map = new Map<string, TopicReviewSummary>()
  for (const review of reviews) {
    const key = topicKey(review.subjectName, review.chapterName, review.topicName)
    const current = map.get(key) ?? {
      key,
      subjectName: review.subjectName,
      topicName: review.topicName ?? '—',
      totalReviews: 0,
      completedReviews: 0,
      lastCompletedOn: null,
      nextDueDate: null,
      mastery: null,
      overdue: 0,
    }
    current.totalReviews += 1
    const status = resolveReviewStatus(review, today)
    if (status === 'completed') {
      current.completedReviews += 1
      const completedOn = review.completedOn ?? null
      if (completedOn && (!current.lastCompletedOn || completedOn > current.lastCompletedOn)) {
        current.lastCompletedOn = completedOn
      }
    } else {
      if (status === 'overdue') current.overdue += 1
      if (!current.nextDueDate || review.dueDate < current.nextDueDate) current.nextDueDate = review.dueDate
      if (review.mastery && (!current.mastery || masteryRank(review.mastery) > masteryRank(current.mastery))) {
        current.mastery = review.mastery
      }
    }
    map.set(key, current)
  }
  return [...map.values()].sort((a, b) => {
    if (a.overdue !== b.overdue) return b.overdue - a.overdue
    return (a.nextDueDate ?? '9999').localeCompare(b.nextDueDate ?? '9999')
  })
}

export function topicKey(subjectName: string, chapterName?: string | null, topicName?: string | null): string {
  return `${subjectName}::${chapterName ?? ''}::${topicName ?? ''}`
}

export function isCompletedOnTime(dueDate: string, completedOn: string | null | undefined): boolean | null {
  if (!completedOn) return null
  return diffDaysISO(completedOn, dueDate) <= 0
}

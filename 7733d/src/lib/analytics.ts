import { addDaysISO, diffDaysISO, endOfWeekISO, faNumber, formatJalali, jalaliMonthRangeISO, startOfWeekISO } from './date.js'
import { aggregateCounts, aggregatePercent, averagePercent, examPercent, trendOf } from './exam.js'
import { courseProgress, courseTotals, type CourseProgress } from './courses.js'
import { countReviews, summarizeTopics, type ReviewCounts } from './review.js'
import { debtSummary, type DebtSummary } from './tasks.js'
import { goalProgress, type GoalProgress } from './goals.js'
import type {
  AppState, Course, Exam, ExamKind, ExamResult, LessonWeights, StudyTask, TestEntry,
} from './model.js'

const DAY_MS = 86400000

function daysBetween(start: string, end: string): string[] {
  const length = diffDaysISO(end, start)
  if (length < 0) return []
  return Array.from({ length: length + 1 }, (_, index) => addDaysISO(start, index))
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0)
}

/* ------------------------------------------------------------------ */
/* Exam analytics                                                      */
/* ------------------------------------------------------------------ */

export type ExamResultFlat = {
  examId: string
  examTitle: string
  date: string
  kind: ExamKind
  resultId: string
  subjectName: string
  topicName: string
  total: number
  correct: number
  wrong: number
  percent: number | null
}

export function flattenExamResults(state: AppState, exams: Exam[] = state.exams): ExamResultFlat[] {
  return exams.flatMap(exam =>
    exam.results.map(result => ({
      examId: exam.id,
      examTitle: exam.title,
      date: exam.date,
      kind: exam.kind,
      resultId: result.id,
      subjectName: result.subjectName,
      topicName: result.topicName,
      total: result.total,
      correct: result.correct,
      wrong: result.wrong,
      percent: examPercent(result),
    })),
  )
}

export function examsInRange(state: AppState, start: string, end: string): Exam[] {
  return state.exams.filter(exam => exam.date >= start && exam.date <= end)
}

export type SubjectStat = {
  subjectName: string
  count: number
  average: number | null
  best: number | null
  worst: number | null
  last: number | null
  lastDate: string | null
  recent7: number | null
  recent30: number | null
  recent90: number | null
  delta: number | null
  direction: 'up' | 'down' | 'flat' | 'none'
  counts: { total: number; correct: number; wrong: number }
}

export function examOverallPercent(exam: Exam): number | null {
  return aggregatePercent(exam.results)
}

export function subjectStats(state: AppState, today: string, windowStart?: string): SubjectStat[] {
  const results = flattenExamResults(state)
    .filter(result => !windowStart || result.date >= windowStart)
  const bySubject = new Map<string, ExamResultFlat[]>()
  for (const result of results) {
    const list = bySubject.get(result.subjectName) ?? []
    list.push(result)
    bySubject.set(result.subjectName, list)
  }
  const within = (items: ExamResultFlat[], days: number) =>
    averagePercent(items.filter(item => diffDaysISO(today, item.date) <= days).map(item => item.percent))

  return [...bySubject.entries()].map(([name, items]) => {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
    const percents = sorted.map(item => item.percent)
    const trend = trendOf(percents)
    const last = sorted[sorted.length - 1]
    return {
      subjectName: name,
      count: sorted.length,
      average: averagePercent(percents),
      best: percents.reduce<number | null>((best, value) => (value === null ? best : best === null ? value : Math.max(best, value)), null),
      worst: percents.reduce<number | null>((worst, value) => (value === null ? worst : worst === null ? value : Math.min(worst, value)), null),
      last: last?.percent ?? null,
      lastDate: last?.date ?? null,
      recent7: within(sorted, 7),
      recent30: within(sorted, 30),
      recent90: within(sorted, 90),
      delta: trend.delta,
      direction: trend.direction,
      counts: aggregateCounts(sorted),
    }
  }).sort((a, b) => b.count - a.count || a.subjectName.localeCompare(b.subjectName, 'fa'))
}

export type TopicStat = {
  subjectName: string
  topicName: string
  count: number
  average: number | null
  best: number | null
  counts: { total: number; correct: number; wrong: number }
}

export function topicStats(state: AppState, windowStart?: string): TopicStat[] {
  const results = flattenExamResults(state).filter(result => result.topicName && (!windowStart || result.date >= windowStart))
  const byTopic = new Map<string, ExamResultFlat[]>()
  for (const result of results) {
    const key = `${result.subjectName}::${result.topicName}`
    const list = byTopic.get(key) ?? []
    list.push(result)
    byTopic.set(key, list)
  }
  return [...byTopic.values()].map(items => {
    const [first] = items
    const percents = items.map(item => item.percent)
    return {
      subjectName: first.subjectName,
      topicName: first.topicName,
      count: items.length,
      average: averagePercent(percents),
      best: percents.reduce<number | null>((best, value) => (value === null ? best : best === null ? value : Math.max(best, value)), null),
      counts: aggregateCounts(items),
    }
  }).sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
}

export type ExamSeriesPoint = { date: string; percent: number | null; label: string; count: number }

/** Per-date weighted exam percentage (weighted by number of questions). */
export function examSeries(state: AppState, start: string, end: string, subjectName?: string): ExamSeriesPoint[] {
  const results = flattenExamResults(state).filter(result =>
    result.date >= start && result.date <= end && (!subjectName || result.subjectName === subjectName),
  )
  const byDate = new Map<string, ExamResultFlat[]>()
  for (const result of results) {
    const list = byDate.get(result.date) ?? []
    list.push(result)
    byDate.set(result.date, list)
  }
  return [...byDate.entries()]
    .map(([date, items]) => ({ date, percent: aggregatePercent(items), label: formatJalali(date, 'dayMonth'), count: items.length }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export type ExamSummary = { exam: Exam; percent: number | null; total: number }

export function recentExams(state: AppState, limit = 5): ExamSummary[] {
  return [...state.exams]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(exam => ({ exam, percent: examOverallPercent(exam), total: sum(exam.results, result => result.total) }))
}

/* ------------------------------------------------------------------ */
/* Daily activity                                                      */
/* ------------------------------------------------------------------ */

export type DayActivity = {
  date: string
  hours: number
  plannedHours: number
  focus: number | null
  tests: number
  correct: number
  wrong: number
  percent: number | null
  reviewsCompleted: number
  tasksCompleted: number
  exams: number
  score: number
  level: 0 | 1 | 2 | 3 | 4
}

function levelFor(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 0) return 0
  if (score < 2) return 1
  if (score < 4) return 2
  if (score < 7) return 3
  return 4
}

export function buildActivity(state: AppState, start: string, end: string): DayActivity[] {
  const days = new Map<string, DayActivity>()
  for (const date of daysBetween(start, end)) {
    days.set(date, {
      date, hours: 0, plannedHours: 0, focus: null, tests: 0, correct: 0, wrong: 0,
      percent: null, reviewsCompleted: 0, tasksCompleted: 0, exams: 0, score: 0, level: 0,
    })
  }
  for (const day of state.studyDays) {
    const cell = days.get(day.date)
    if (!cell) continue
    cell.hours = day.hours
    cell.plannedHours = day.plannedHours
    cell.focus = day.focus
  }
  for (const test of state.tests) {
    const cell = days.get(test.date)
    if (!cell) continue
    cell.tests += test.total
    cell.correct += test.correct
    cell.wrong += test.wrong
  }
  for (const review of state.reviews) {
    if (review.status !== 'completed' || !review.completedOn) continue
    const cell = days.get(review.completedOn)
    if (cell) cell.reviewsCompleted += 1
  }
  for (const task of state.tasks) {
    if (task.status !== 'done' || !task.completedAt) continue
    const cell = days.get(task.completedAt.slice(0, 10))
    if (cell) cell.tasksCompleted += 1
  }
  for (const exam of state.exams) {
    const cell = days.get(exam.date)
    if (cell) cell.exams += 1
  }
  for (const cell of days.values()) {
    cell.percent = cell.tests > 0 ? examPercent({ total: cell.tests, correct: cell.correct, wrong: cell.wrong }) : null
    cell.score = Math.round((cell.hours * 2 + cell.tests / 25 + cell.reviewsCompleted * 1.5 + cell.tasksCompleted * 0.5 + cell.exams * 2) * 100) / 100
    cell.level = levelFor(cell.score)
  }
  return [...days.values()]
}

export type HeatmapWeek = { days: DayActivity[] }

/** Saturday-first columns for a GitHub-style activity calendar. */
export function heatmapWeeks(state: AppState, today: string, weeks = 26): HeatmapWeek[] {
  const currentWeekStart = startOfWeekISO(today)
  const firstStart = addDaysISO(currentWeekStart, -(weeks - 1) * 7)
  const end = addDaysISO(currentWeekStart, 6)
  const activity = new Map(buildActivity(state, firstStart, end).map(day => [day.date, day]))
  const columns: HeatmapWeek[] = []
  for (let week = 0; week < weeks; week += 1) {
    const weekStart = addDaysISO(firstStart, week * 7)
    columns.push({
      days: daysBetween(weekStart, addDaysISO(weekStart, 6)).map(date => activity.get(date) ?? {
        date, hours: 0, plannedHours: 0, focus: null, tests: 0, correct: 0, wrong: 0,
        percent: null, reviewsCompleted: 0, tasksCompleted: 0, exams: 0, score: 0, level: 0,
      }),
    })
  }
  return columns
}

/* ------------------------------------------------------------------ */
/* Period reports                                                      */
/* ------------------------------------------------------------------ */

export type PeriodStats = {
  start: string
  end: string
  hours: number
  plannedHours: number
  activeDays: number
  tests: { total: number; correct: number; wrong: number; percent: number | null }
  reviews: { completed: number; due: number }
  exams: { count: number; percent: number | null }
  tasks: { created: number; completed: number }
  goalPercent: number
}

export function periodStats(state: AppState, start: string, end: string, weeklyTarget = 0): PeriodStats {
  const days = state.studyDays.filter(day => day.date >= start && day.date <= end)
  const tests = state.tests.filter(test => test.date >= start && test.date <= end)
  const exams = state.exams.filter(exam => exam.date >= start && exam.date <= end)
  const completedReviews = state.reviews.filter(review => review.status === 'completed' && review.completedOn && review.completedOn >= start && review.completedOn <= end)
  const dueReviews = state.reviews.filter(review => review.dueDate >= start && review.dueDate <= end)
  const createdTasks = state.tasks.filter(task => task.createdAt.slice(0, 10) >= start && task.createdAt.slice(0, 10) <= end)
  const completedTasks = state.tasks.filter(task => task.status === 'done' && task.completedAt && task.completedAt.slice(0, 10) >= start && task.completedAt.slice(0, 10) <= end)
  const activity = buildActivity(state, start, end)
  const hours = sum(days, day => day.hours)
  const counts = aggregateCounts(tests)
  return {
    start,
    end,
    hours,
    plannedHours: sum(days, day => day.plannedHours),
    activeDays: activity.filter(day => day.score > 0).length,
    tests: {
      ...counts,
      percent: examPercent(counts),
    },
    reviews: { completed: completedReviews.length, due: dueReviews.length },
    exams: {
      count: exams.length,
      percent: aggregatePercent(exams.flatMap(exam => exam.results)),
    },
    tasks: { created: createdTasks.length, completed: completedTasks.length },
    goalPercent: weeklyTarget > 0 ? Math.round((hours / weeklyTarget) * 1000) / 10 : 0,
  }
}

export type SubjectDelta = { subjectName: string; current: number; previous: number; delta: number }

function subjectAveragesInRange(state: AppState, start: string, end: string): Map<string, { total: number; correct: number; wrong: number; count: number }> {
  const map = new Map<string, { total: number; correct: number; wrong: number; count: number }>()
  for (const result of flattenExamResults(state)) {
    if (result.date < start || result.date > end) continue
    const current = map.get(result.subjectName) ?? { total: 0, correct: 0, wrong: 0, count: 0 }
    current.total += result.total
    current.correct += result.correct
    current.wrong += result.wrong
    current.count += 1
    map.set(result.subjectName, current)
  }
  return map
}

export function subjectDeltas(state: AppState, currentStart: string, currentEnd: string, previousStart: string, previousEnd: string): SubjectDelta[] {
  const current = subjectAveragesInRange(state, currentStart, currentEnd)
  const previous = subjectAveragesInRange(state, previousStart, previousEnd)
  return [...current.entries()].flatMap(([subjectName, counts]) => {
    const before = previous.get(subjectName)
    if (!before) return []
    const now = aggregatePercent([counts])
    const then = aggregatePercent([before])
    return now === null || then === null ? [] : [{ subjectName, current: now, previous: then, delta: now - then }]
  }).sort((a, b) => b.delta - a.delta)
}

export type WeeklyReport = {
  start: string
  end: string
  stats: PeriodStats
  previous: PeriodStats
  subjectDeltas: SubjectDelta[]
  subjectStats: SubjectStat[]
  debt: DebtSummary
  reviewsNow: ReviewCounts
  weeklyGoal: GoalProgress
  courses: ReturnType<typeof courseTotals>
  changes: { hours: number | null; tests: number | null; exam: number | null; activeDays: number | null }
}

export function buildWeeklyReport(state: AppState, weekStart: string, today: string): WeeklyReport {
  const start = weekStart
  const end = endOfWeekISO(start)
  const previousStart = addDaysISO(start, -7)
  const previousEnd = addDaysISO(start, -1)
  const stats = periodStats(state, start, end, state.settings.goals.weeklyHours)
  const previous = periodStats(state, previousStart, previousEnd, state.settings.goals.weeklyHours)
  return {
    start,
    end,
    stats,
    previous,
    subjectDeltas: subjectDeltas(state, start, end, previousStart, previousEnd),
    subjectStats: subjectStats(state, today, start),
    debt: debtSummary(state.tasks, today),
    reviewsNow: countReviews(state.reviews, today),
    weeklyGoal: goalProgress(state.studyDays, state.settings.goals, today).weekly,
    courses: courseTotals(state.courses, state.settings.lessonWeights),
    changes: {
      hours: stats.hours - previous.hours,
      tests: stats.tests.total - previous.tests.total,
      exam: stats.exams.percent !== null && previous.exams.percent !== null ? stats.exams.percent - previous.exams.percent : null,
      activeDays: stats.activeDays - previous.activeDays,
    },
  }
}

export type MonthlyReport = {
  start: string
  end: string
  stats: PeriodStats
  weeks: { start: string; end: string; hours: number; tests: number; activeDays: number; label: string }[]
  subjectStats: SubjectStat[]
  courseProgress: CourseProgress[]
  monthlyGoal: GoalProgress
  reviewsNow: ReviewCounts
  examSeries: ExamSeriesPoint[]
  debt: DebtSummary
}

export function buildMonthlyReport(state: AppState, today: string): MonthlyReport {
  const range = jalaliMonthRangeISO(today) ?? { start: addDaysISO(today, -29), end: today }
  const stats = periodStats(state, range.start, range.end, state.settings.goals.monthlyHours)
  const weeks: MonthlyReport['weeks'] = []
  let cursor = startOfWeekISO(range.start)
  while (cursor <= range.end) {
    const end = endOfWeekISO(cursor)
    const inside = periodStats(state, cursor < range.start ? range.start : cursor, end > range.end ? range.end : end)
    weeks.push({
      start: cursor,
      end,
      hours: inside.hours,
      tests: inside.tests.total,
      activeDays: inside.activeDays,
      label: formatJalali(cursor, 'dayMonth'),
    })
    cursor = addDaysISO(cursor, 7)
  }
  return {
    start: range.start,
    end: range.end,
    stats,
    weeks,
    subjectStats: subjectStats(state, today, range.start),
    courseProgress: state.courses.map(course => courseProgress(course, state.settings.lessonWeights)),
    monthlyGoal: goalProgress(state.studyDays, state.settings.goals, today).monthly,
    reviewsNow: countReviews(state.reviews, today),
    examSeries: examSeries(state, range.start, range.end),
    debt: debtSummary(state.tasks, today),
  }
}

/* ------------------------------------------------------------------ */
/* Weekly review analysis                                              */
/* ------------------------------------------------------------------ */

export type WeeklyReviewAnalysis = {
  sufficientData: boolean
  confidence: 'کم' | 'متوسط' | 'زیاد'
  strengths: string[]
  problems: string[]
  mostImproved: SubjectDelta | null
  mostDeclined: SubjectDelta | null
  unfinished: DebtSummary
  suggestions: string[]
  caveats: string[]
}

export function buildWeeklyReview(state: AppState, weekStart: string, today: string): WeeklyReviewAnalysis {
  const report = buildWeeklyReport(state, weekStart, today)
  const dataPoints = report.stats.activeDays + report.stats.exams.count
  const sufficientData = report.stats.activeDays >= 3 || report.stats.exams.count >= 2
  const confidence: WeeklyReviewAnalysis['confidence'] = dataPoints >= 10 ? 'زیاد' : dataPoints >= 5 ? 'متوسط' : 'کم'

  const strengths: string[] = []
  const problems: string[] = []
  const suggestions: string[] = []
  const caveats: string[] = []

  if (report.stats.hours > 0) {
    if (report.stats.goalPercent >= 100) strengths.push(`هدف مطالعهٔ هفتگی با ${report.stats.hours.toFixed(1)} ساعت کامل شد.`)
    else if (report.changes.hours !== null && report.changes.hours > 0) strengths.push(`ساعت مطالعه نسبت به هفتهٔ قبل ${report.changes.hours.toFixed(1)} ساعت بیشتر شد.`)
  }
  if (report.stats.activeDays >= 5) strengths.push(`در ${report.stats.activeDays} روز از هفته فعالیت ثبت شده است.`)
  const bestSubject = [...report.subjectStats].filter(item => item.count > 0 && item.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0]
  if (bestSubject && (bestSubject.average ?? 0) >= 50) {
    strengths.push(`بهترین میانگین آزمون این هفته: ${bestSubject.subjectName} با ${bestSubject.average!.toFixed(1)}٪.`)
  }
  if (report.stats.tests.total > 0 && (report.stats.tests.percent ?? 0) > 0) {
    strengths.push(`در ${report.stats.tests.total} تست ثبت‌شده، درصد کلی ${report.stats.tests.percent!.toFixed(1)}٪ بوده است.`)
  }

  if (report.stats.goalPercent < 70 && report.stats.hours > 0) {
    problems.push(`تحقق هدف هفتگی ${report.stats.goalPercent.toFixed(1)}٪ است؛ فاصلهٔ ${Math.max(0, state.settings.goals.weeklyHours - report.stats.hours).toFixed(1)} ساعت باقی مانده.`)
  }
  if (report.stats.hours === 0) problems.push('این هفته هیچ ساعت مطالعه‌ای ثبت نشده است.')
  if (report.reviewsNow.overdue > 0) problems.push(`${report.reviewsNow.overdue} مرور عقب‌افتاده منتظر انجام است.`)
  if (report.debt.overdue > 0) problems.push(`${report.debt.overdue} کار مطالعاتی از موعد گذشته است.`)
  const weakest = [...report.subjectStats].filter(item => item.average !== null && item.count >= 2).sort((a, b) => (a.average ?? 0) - (b.average ?? 0))[0]
  if (weakest && (weakest.average ?? 100) < 40) problems.push(`ضعیف‌ترین درس این هفته ${weakest.subjectName} با میانگین ${weakest.average!.toFixed(1)}٪ است.`)

  const improved = report.subjectDeltas.filter(item => item.delta > 0).sort((a, b) => b.delta - a.delta)[0] ?? null
  const declined = report.subjectDeltas.filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta)[0] ?? null
  if (improved) strengths.push(`${improved.subjectName} نسبت به هفتهٔ قبل ${improved.delta.toFixed(1)} واحد درصد بهبود داشته است.`)
  if (declined) problems.push(`${declined.subjectName} نسبت به هفتهٔ قبل ${Math.abs(declined.delta).toFixed(1)} واحد درصد افت داشته است.`)

  if (report.reviewsNow.overdue > 0) suggestions.push('مرورهای عقب‌افتاده را بر اساس تاریخ سررسید مرتب کن و ابتدا قدیمی‌ترین‌ها را انجام بده.')
  if (weakest) suggestions.push(`برای ${weakest.subjectName} یک جلسهٔ تست هدفمند و سپس مرور کوتاه برنامه‌ریزی کن.`)
  if (report.stats.tests.total === 0) suggestions.push('این هفته تستی ثبت نشده؛ ثبت یک جلسهٔ تست کوتاه تصویر دقیق‌تری از عملکرد می‌دهد.')
  if (report.stats.activeDays < 4 && report.stats.hours > 0) suggestions.push('توزیع مطالعه در روزهای بیشتر، بازیابی و مرور را پایدارتر می‌کند.')
  if (report.debt.overdue > 0) suggestions.push(`${report.debt.overdue} کار عقب‌افتاده را به هفتهٔ بعد منتقل نکن؛ برای هرکدام یک بازهٔ مشخص تعیین کن.`)
  if (report.stats.hours > 0 && report.stats.exams.count === 0) suggestions.push('برای سنجش واقعی پیشرفت، حداقل یک آزمون در هفته ثبت کن.')
  if (!sufficientData) caveats.push('برای جمع‌بندی هفتگی، حداقل ۳ روز فعالیت یا ۲ آزمون لازم است؛ تا آن زمان نتیجه‌گیری قطعی انجام نمی‌شود.')

  return {
    sufficientData,
    confidence,
    strengths: sufficientData ? strengths : [],
    problems: sufficientData ? problems : [],
    mostImproved: improved,
    mostDeclined: declined,
    unfinished: report.debt,
    suggestions: sufficientData ? suggestions : [],
    caveats,
  }
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

export type Achievement = {
  id: string
  title: string
  description: string
  achieved: boolean
  percent: number
  detail: string
}

export function activeDaySet(state: AppState): Set<string> {
  const dates = new Set<string>()
  for (const day of state.studyDays) if (day.hours > 0) dates.add(day.date)
  for (const test of state.tests) if (test.total > 0) dates.add(test.date)
  for (const review of state.reviews) if (review.status === 'completed' && review.completedOn) dates.add(review.completedOn)
  return dates
}

export function studyStreak(state: AppState, today: string): number {
  const dates = activeDaySet(state)
  let cursor = dates.has(today) ? today : addDaysISO(today, -1)
  let streak = 0
  while (dates.has(cursor)) {
    streak += 1
    cursor = addDaysISO(cursor, -1)
  }
  return streak
}

export function buildAchievements(state: AppState, today: string): Achievement[] {
  const streak = studyStreak(state, today)
  const completedReviews = state.reviews.filter(review => review.status === 'completed').length
  const tests = sum(state.tests, test => test.total)
  const completedCourses = state.courses.filter(course => course.lessons.length > 0 && courseProgress(course, state.settings.lessonWeights).learningPercent >= 99.999).length
  const month = jalaliMonthRangeISO(today) ?? { start: addDaysISO(today, -29), end: today }
  const monthHours = sum(state.studyDays.filter(day => day.date >= month.start && day.date <= month.end), day => day.hours)
  const activeDays = activeDaySet(state).size
  const masteredTopics = state.topics.filter(topic => topic.status === 'mastered' || topic.mastery === 'excellent').length

  const achievement = (id: string, title: string, description: string, value: number, target: number, unit: string): Achievement => ({
    id,
    title,
    description,
    achieved: value >= target,
    percent: Math.min(100, Math.round((value / target) * 1000) / 10),
    detail: `${faNumber(value, Number.isInteger(value) ? 0 : 1)} از ${faNumber(target, 0)} ${unit}`,
  })

  return [
    achievement('streak-7', '۷ روز مطالعهٔ پیوسته', 'فعالیت ثبت‌شده در هفت روز پیاپی', streak, 7, 'روز'),
    achievement('reviews-50', '۵۰ مرور تکمیل‌شده', 'انجام پیوستهٔ مرورهای برنامه‌ریزی‌شده', completedReviews, 50, 'مرور'),
    achievement('tests-1000', '۱۰۰۰ تست', 'مجموع تست‌های ثبت‌شده', tests, 1000, 'تست'),
    achievement('course-complete', 'تکمیل یک دوره', 'اتمام همهٔ مراحل یادگیری یک دوره', completedCourses, 1, 'دوره'),
    achievement('monthly-goal', 'تحقق هدف ماهانه', 'رسیدن به هدف ساعت مطالعهٔ ماه', Math.round(monthHours * 10) / 10, state.settings.goals.monthlyHours, 'ساعت'),
    achievement('active-days-30', '۳۰ روز فعالیت', 'روزهای دارای مطالعه، تست یا مرور', activeDays, 30, 'روز'),
    achievement('topics-10', 'تسلط بر ۱۰ مبحث', 'مباحث با وضعیت مسلط', masteredTopics, 10, 'مبحث'),
  ]
}

/* ------------------------------------------------------------------ */
/* AI analyst layer (rule-based, deterministic, real data only)        */
/* ------------------------------------------------------------------ */

export type Insight = {
  id: string
  tone: 'positive' | 'warning' | 'neutral'
  title: string
  detail: string
  evidence: string[]
}

export type LearningAnalysis = {
  enoughData: boolean
  dataNote: string
  facts: Insight[]
  suggestions: Insight[]
}

export function analyzeLearning(state: AppState, today: string): LearningAnalysis {
  const windowStart = addDaysISO(today, -13)
  const previousStart = addDaysISO(today, -27)
  const previousEnd = addDaysISO(today, -14)
  const recent = buildActivity(state, windowStart, today)
  const previous = buildActivity(state, previousStart, previousEnd)
  const recentHours = sum(recent, day => day.hours)
  const previousHours = sum(previous, day => day.hours)
  const recentActive = recent.filter(day => day.score > 0).length
  const reviews = countReviews(state.reviews, today)
  const subjects = subjectStats(state, today)
  const topics = topicStats(state)
  const debt = debtSummary(state.tasks, today)
  const enoughData = recentActive >= 4 || state.exams.length >= 2 || state.reviews.length >= 3

  const facts: Insight[] = []
  const suggestions: Insight[] = []

  if (recentHours > 0 || previousHours > 0) {
    const delta = recentHours - previousHours
    facts.push({
      id: 'study-trend',
      tone: delta >= 0 ? 'positive' : 'warning',
      title: delta >= 0 ? 'روند مطالعهٔ دو هفته اخیر افزایشی است' : 'روند مطالعهٔ دو هفته اخیر کاهشی است',
      detail: `${recentHours.toFixed(1)} ساعت در ۱۴ روز اخیر در برابر ${previousHours.toFixed(1)} ساعت در ۱۴ روز پیش از آن.`,
      evidence: [`اختلاف: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ساعت`, `${recentActive} روز فعال در بازهٔ اخیر`],
    })
  }

  const weakTopics = topics.filter(topic => topic.count >= 2 && (topic.average ?? 100) < 40).slice(0, 3)
  if (weakTopics.length) {
    facts.push({
      id: 'weak-topics',
      tone: 'warning',
      title: 'مباحث ضعیف در آزمون‌ها شناسایی شد',
      detail: weakTopics.map(topic => `${topic.subjectName} · ${topic.topicName} (${(topic.average ?? 0).toFixed(1)}٪)`).join('، '),
      evidence: weakTopics.map(topic => `${topic.count} آزمون ثبت‌شده`),
    })
    suggestions.push({
      id: 'weak-topic-plan',
      tone: 'warning',
      title: 'اولویت مطالعه را روی ضعیف‌ترین مبحث بگذار',
      detail: `برای «${weakTopics[0].topicName}» یک جلسهٔ مرور و سپس تست هدفمند برنامه‌ریزی کن.`,
      evidence: [`میانگین فعلی: ${(weakTopics[0].average ?? 0).toFixed(1)}٪`, `بر پایهٔ ${weakTopics[0].count} آزمون`],
    })
  }

  if (reviews.overdue > 0) {
    facts.push({
      id: 'overdue-reviews',
      tone: 'warning',
      title: `${reviews.overdue} مرور عقب‌افتاده`,
      detail: 'این مرورها از تاریخ سررسید گذشته‌اند و در تحلیل فعلی لحاظ نشده‌اند.',
      evidence: [`${reviews.today} مرور برای امروز`, `${reviews.upcoming} مرور آینده`],
    })
    suggestions.push({
      id: 'fix-overdue',
      tone: 'warning',
      title: 'ابتدا بدهی مرور را تسویه کن',
      detail: 'قدیمی‌ترین مرورهای عقب‌افتاده را انجام بده یا تاریخشان را به‌صورت آگاهانه جابه‌جا کن.',
      evidence: ['وضعیت از تاریخ سررسید محاسبه شده است.'],
    })
  }

  const gapCourses = state.courses.flatMap(course => {
    const progress = courseProgress(course, state.settings.lessonWeights)
    return progress.totalSessions > 0 && progress.videoPercent - progress.learningPercent >= 25
      ? [{ course, progress }]
      : []
  })
  if (gapCourses.length) {
    const first = gapCourses[0]
    facts.push({
      id: 'video-learning-gap',
      tone: 'warning',
      title: 'فاصلهٔ پیشرفت ویدئویی و یادگیری واقعی',
      detail: `در ${gapCourses.length} دوره، تماشای ویدئو جلوتر از تکمیل مراحل یادگیری است.`,
      evidence: gapCourses.slice(0, 3).map(item => `${item.course.title}: ویدئو ${item.progress.videoPercent.toFixed(0)}٪ / یادگیری ${item.progress.learningPercent.toFixed(0)}٪`),
    })
    suggestions.push({
      id: 'close-gap',
      tone: 'neutral',
      title: `مراحل جاماندهٔ «${first.course.title}» را کامل کن`,
      detail: 'تست آموزشی و تکلیف، تفاوت تماشا با یادگیری را مشخص می‌کنند.',
      evidence: [`${first.progress.completedSessions} جلسهٔ کامل از ${first.progress.totalSessions} جلسه`],
    })
  }

  const weakSubject = subjects.filter(subject => subject.count >= 2 && (subject.average ?? 100) < 45).sort((a, b) => (a.average ?? 0) - (b.average ?? 0))[0]
  if (weakSubject) {
    facts.push({
      id: 'weak-subject',
      tone: 'warning',
      title: `میانگین پایین ${weakSubject.subjectName}`,
      detail: `میانگین ${(weakSubject.average ?? 0).toFixed(1)}٪ در ${weakSubject.count} آزمون.`,
      evidence: [`بهترین: ${(weakSubject.best ?? 0).toFixed(1)}٪`, `آخرین: ${(weakSubject.last ?? 0).toFixed(1)}٪`],
    })
  }

  const best = subjects.filter(subject => subject.count >= 2 && subject.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0]
  if (best) {
    facts.push({
      id: 'strong-subject',
      tone: 'positive',
      title: `${best.subjectName} نقطهٔ قوت فعلی است`,
      detail: `میانگین ${(best.average ?? 0).toFixed(1)}٪ در ${best.count} آزمون.`,
      evidence: [`بهترین درصد: ${(best.best ?? 0).toFixed(1)}٪`],
    })
  }

  if (debt.overdue > 0 || debt.highPriority > 0) {
    facts.push({
      id: 'task-debt',
      tone: debt.overdue > 0 ? 'warning' : 'neutral',
      title: 'بدهی مطالعاتی باز',
      detail: `${debt.open} کار باز، شامل ${debt.overdue} کار عقب‌افتاده و ${debt.highPriority} کار با اولویت بالا.`,
      evidence: [`${debt.dueSoon} کار در سه روز آینده`, `${debt.completed} کار تکمیل‌شده`],
    })
    if (debt.highPriority > 0) {
      suggestions.push({
        id: 'priority-first',
        tone: 'neutral',
        title: 'کارهای با اولویت بالا را اول بگذار',
        detail: 'در صفحهٔ بدهی مطالعاتی، ترتیب خودکار اولویت و مهلت را نشان می‌دهد.',
        evidence: [`${debt.highPriority} کار با اولویت بالا`],
      })
    }
  }

  if (recentActive <= 2 && recentHours > 0) {
    facts.push({
      id: 'consistency',
      tone: 'neutral',
      title: 'مطالعه در روزهای محدودی متمرکز است',
      detail: `در ۱۴ روز اخیر فقط ${recentActive} روز فعال ثبت شده است.`,
      evidence: [`${recentHours.toFixed(1)} ساعت مجموع`],
    })
    suggestions.push({
      id: 'spread-sessions',
      tone: 'neutral',
      title: 'جلسه‌ها را در روزهای بیشتری پخش کن',
      detail: 'مرور فاصله‌دار وقتی بهتر جواب می‌دهد که فاصلهٔ بین جلسه‌ها کوتاه‌تر و منظم‌تر باشد.',
      evidence: [`${recentActive} روز فعال از ۱۴ روز`],
    })
  }

  const dataNote = enoughData
    ? 'این تحلیل فقط از داده‌های ثبت‌شده در همین حساب ساخته شده است.'
    : 'برای تحلیل معنادار، حداقل ۴ روز فعالیت یا ۲ آزمون یا ۳ مرور لازم است. تا آن زمان هیچ نتیجه‌گیری‌ای ارائه نمی‌شود.'

  return {
    enoughData,
    dataNote,
    facts: enoughData ? facts : [],
    suggestions: enoughData ? suggestions : [],
  }
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type DashboardData = {
  today: DayActivity
  goals: { daily: GoalProgress; weekly: GoalProgress; monthly: GoalProgress }
  reviews: ReviewCounts
  subjects: SubjectStat[]
  recentExams: ExamSummary[]
  examTrend: { delta: number | null; direction: 'up' | 'down' | 'flat' | 'none' }
  courses: ReturnType<typeof courseTotals>
  courseList: { course: Course; progress: CourseProgress }[]
  debt: DebtSummary
  studySeries: DayActivity[]
  weeklySeries: { start: string; label: string; hours: number; tests: number; activeDays: number }[]
  examSeries: ExamSeriesPoint[]
  testsToday: TestEntry[]
  dueSoon: StudyTask[]
}

export function buildDashboard(state: AppState, today: string): DashboardData {
  const studyStart = addDaysISO(today, -13)
  const studySeries = buildActivity(state, studyStart, today)
  const timeline = examSeries(state, addDaysISO(today, -89), today)
  const todayActivity = studySeries[studySeries.length - 1] ?? buildActivity(state, today, today)[0]
  const weeklySeries = Array.from({ length: 6 }, (_, index) => {
    const start = startOfWeekISO(addDaysISO(today, -(5 - index) * 7))
    const end = endOfWeekISO(start)
    const activity = buildActivity(state, start, end)
    return {
      start,
      label: formatJalali(start, 'dayMonth'),
      hours: sum(activity, day => day.hours),
      tests: sum(activity, day => day.tests),
      activeDays: activity.filter(day => day.score > 0).length,
    }
  })
  const courseList = state.courses.map(course => ({ course, progress: courseProgress(course, state.settings.lessonWeights) }))
  return {
    today: todayActivity,
    goals: goalProgress(state.studyDays, state.settings.goals, today),
    reviews: countReviews(state.reviews, today),
    subjects: subjectStats(state, today),
    recentExams: recentExams(state, 5),
    examTrend: trendOf(timeline.map(point => point.percent)),
    courses: courseTotals(state.courses, state.settings.lessonWeights),
    courseList,
    debt: debtSummary(state.tasks, today),
    studySeries,
    weeklySeries,
    examSeries: timeline.slice(-30),
    testsToday: state.tests.filter(test => test.date === today),
    dueSoon: [...state.tasks]
      .filter(task => task.status === 'open' && task.dueDate >= today && diffDaysISO(task.dueDate, today) <= 3)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  }
}

export function topicSummaries(state: AppState, today: string) {
  return summarizeTopics(state.reviews.map(review => ({
    ...review,
    completedOn: review.completedOn,
  })), today)
}

export function minutesBetweenHours(hours: number): number {
  return Math.round(hours * 60)
}

export function daysAgoISO(today: string, days: number): string {
  return addDaysISO(today, -days)
}

export type LessonWeight = LessonWeights

export type ExamResultRef = ExamResult

export const ANALYTICS_DAY_MS = DAY_MS

import { addDaysISO, diffDaysISO, endOfWeekISO, jalaliMonthRangeISO, startOfWeekISO } from './date.js'

export type GoalSettings = {
  dailyHours: number
  weeklyHours: number
  monthlyHours: number
}

export type StudyDayLike = { date: string; hours: number }
export type TestDayLike = { date: string; total: number; correct: number; wrong: number }

export const DEFAULT_GOALS: GoalSettings = {
  dailyHours: 5,
  weeklyHours: 35,
  monthlyHours: 150,
}

export const MAX_GOAL_HOURS = { daily: 24, weekly: 168, monthly: 744 } as const

export function isValidGoalSettings(value: unknown): value is GoalSettings {
  if (!value || typeof value !== 'object') return false
  const goals = value as Partial<GoalSettings>
  return (
    typeof goals.dailyHours === 'number' && Number.isFinite(goals.dailyHours) && goals.dailyHours >= 0 && goals.dailyHours <= MAX_GOAL_HOURS.daily &&
    typeof goals.weeklyHours === 'number' && Number.isFinite(goals.weeklyHours) && goals.weeklyHours >= 0 && goals.weeklyHours <= MAX_GOAL_HOURS.weekly &&
    typeof goals.monthlyHours === 'number' && Number.isFinite(goals.monthlyHours) && goals.monthlyHours >= 0 && goals.monthlyHours <= MAX_GOAL_HOURS.monthly
  )
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

export function hoursInRange(days: StudyDayLike[], start: string, end: string): number {
  return days.reduce((sum, day) => (isDateInRange(day.date, start, end) ? sum + Math.max(0, day.hours) : sum), 0)
}

export function testsInRange(tests: TestDayLike[], start: string, end: string): { total: number; correct: number; wrong: number; days: number } {
  const inside = tests.filter(test => isDateInRange(test.date, start, end))
  return {
    total: inside.reduce((sum, test) => sum + test.total, 0),
    correct: inside.reduce((sum, test) => sum + test.correct, 0),
    wrong: inside.reduce((sum, test) => sum + test.wrong, 0),
    days: new Set(inside.map(test => test.date)).size,
  }
}

export type GoalProgress = {
  title: string
  target: number
  value: number
  percent: number
  start: string
  end: string
  remaining: number
}

export function makeGoalProgress(title: string, target: number, value: number, start: string, end: string): GoalProgress {
  const percent = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return {
    title,
    target,
    value: Math.round(value * 100) / 100,
    percent: Math.round(percent * 10) / 10,
    start,
    end,
    remaining: Math.max(0, Math.round((target - value) * 100) / 100),
  }
}

export function goalProgress(days: StudyDayLike[], goals: GoalSettings, today: string): {
  daily: GoalProgress
  weekly: GoalProgress
  monthly: GoalProgress
} {
  const weekStart = startOfWeekISO(today)
  const weekEnd = endOfWeekISO(today)
  const month = jalaliMonthRangeISO(today) ?? { start: addDaysISO(today, -29), end: today }
  return {
    daily: makeGoalProgress('هدف امروز', goals.dailyHours, hoursInRange(days, today, today), today, today),
    weekly: makeGoalProgress('هدف هفته', goals.weeklyHours, hoursInRange(days, weekStart, weekEnd), weekStart, weekEnd),
    monthly: makeGoalProgress('هدف ماه', goals.monthlyHours, hoursInRange(days, month.start, month.end), month.start, month.end),
  }
}

/** Elapsed share of the current week/month, used to show pace instead of raw percent. */
export function elapsedShare(start: string, end: string, today: string): number {
  const length = diffDaysISO(end, start) + 1
  const elapsed = diffDaysISO(today, start) + 1
  if (length <= 0) return 0
  return Math.max(0, Math.min(1, elapsed / length))
}

export function paceLabel(progress: GoalProgress, today: string): 'ahead' | 'on-track' | 'behind' {
  const share = elapsedShare(progress.start, progress.end, today)
  if (share <= 0) return 'on-track'
  const pace = progress.target > 0 ? progress.value / progress.target : 0
  if (pace + 0.05 >= share) return 'ahead'
  if (pace + 0.25 >= share) return 'on-track'
  return 'behind'
}

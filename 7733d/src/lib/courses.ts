import type { Course, Lesson, LessonWeights } from './model.js'
import { DEFAULT_LESSON_WEIGHTS } from './model.js'

export type LessonStep = 'video' | 'test' | 'assignment' | 'review' | 'mastery'

export const LESSON_STEPS: { key: LessonStep; label: string }[] = [
  { key: 'video', label: 'مشاهدهٔ ویدئو' },
  { key: 'test', label: 'حل تست آموزشی' },
  { key: 'assignment', label: 'انجام تکلیف' },
  { key: 'review', label: 'مرور' },
  { key: 'mastery', label: 'ارزیابی تسلط' },
]

export function isMasteryAssessed(lesson: Lesson): boolean {
  return lesson.mastery === 'good' || lesson.mastery === 'excellent'
}

export function isStepDone(lesson: Lesson, step: LessonStep): boolean {
  switch (step) {
    case 'video': return lesson.watched
    case 'test': return lesson.testDone
    case 'assignment': return lesson.assignmentDone
    case 'review': return lesson.reviewed
    case 'mastery': return isMasteryAssessed(lesson)
  }
}

export function lessonCompletion(lesson: Lesson, weights: LessonWeights = DEFAULT_LESSON_WEIGHTS): number {
  const totalWeight = LESSON_STEPS.reduce((sum, step) => sum + Math.max(0, weights[step.key] ?? 0), 0)
  if (totalWeight <= 0) return 0
  const doneWeight = LESSON_STEPS.reduce(
    (sum, step) => sum + (isStepDone(lesson, step.key) ? Math.max(0, weights[step.key] ?? 0) : 0),
    0,
  )
  return (doneWeight / totalWeight) * 100
}

export type CourseProgress = {
  totalSessions: number
  watchedSessions: number
  completedSessions: number
  remainingSessions: number
  watchedMinutes: number
  remainingMinutes: number
  totalMinutes: number
  videoPercent: number
  learningPercent: number
}

/**
 * Video progress counts watched sessions only. Learning progress is the weighted
 * share of every completed learning step, so watching a video alone cannot
 * report a finished course.
 */
export function courseProgress(course: Course, weights: LessonWeights = DEFAULT_LESSON_WEIGHTS): CourseProgress {
  const lessons = course.lessons
  const totalSessions = lessons.length
  const watchedSessions = lessons.filter(lesson => lesson.watched).length
  const completedSessions = lessons.filter(lesson => lessonCompletion(lesson, weights) >= 99.999).length
  const watchedMinutes = lessons.filter(lesson => lesson.watched).reduce((sum, lesson) => sum + lesson.durationMin, 0)
  const totalMinutes = lessons.reduce((sum, lesson) => sum + lesson.durationMin, 0)
  const learningPercent = totalSessions > 0
    ? lessons.reduce((sum, lesson) => sum + lessonCompletion(lesson, weights), 0) / totalSessions
    : 0
  return {
    totalSessions,
    watchedSessions,
    completedSessions,
    remainingSessions: Math.max(0, totalSessions - watchedSessions),
    watchedMinutes,
    remainingMinutes: Math.max(0, totalMinutes - watchedMinutes),
    totalMinutes,
    videoPercent: totalSessions > 0 ? (watchedSessions / totalSessions) * 100 : 0,
    learningPercent,
  }
}

export function lessonVideoPercent(lesson: Lesson): number {
  return lesson.watched ? 100 : 0
}

export function nextLesson(course: Course): Lesson | null {
  return [...course.lessons]
    .sort((a, b) => a.order - b.order)
    .find(lesson => !lesson.watched) ?? null
}

export function courseTotals(courses: Course[], weights: LessonWeights = DEFAULT_LESSON_WEIGHTS) {
  const progresses = courses.map(course => courseProgress(course, weights))
  const totalSessions = progresses.reduce((sum, item) => sum + item.totalSessions, 0)
  const watchedSessions = progresses.reduce((sum, item) => sum + item.watchedSessions, 0)
  const learningPercent = progresses.length
    ? progresses.reduce((sum, item) => sum + item.learningPercent, 0) / progresses.length
    : 0
  return {
    totalCourses: courses.length,
    totalSessions,
    watchedSessions,
    remainingSessions: Math.max(0, totalSessions - watchedSessions),
    videoPercent: totalSessions > 0 ? (watchedSessions / totalSessions) * 100 : 0,
    learningPercent,
    activeCourses: courses.filter(course => course.status === 'active').length,
    completedCourses: courses.filter(course => course.lessons.length > 0 && courseProgress(course, weights).learningPercent >= 99.999).length,
  }
}

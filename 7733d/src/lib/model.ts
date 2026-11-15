import { DEFAULT_GOALS, isValidGoalSettings, type GoalSettings } from './goals.js'
import { isValidISODate, startOfWeekISO } from './date.js'
import {
  DEFAULT_MASTERY_INTERVALS, isValidMastery, isValidMasteryIntervals, MASTERY_LEVELS,
  type Mastery, type ReviewType,
} from './review.js'

/**
 * Moroor V2 keeps every user record in one versioned, user-owned document.
 * The document holds normalized entity collections (no duplicated day totals);
 * percentages and counters are always derived at read time.
 */
export const SCHEMA_VERSION = 2

export type PaletteKey = 'blue' | 'violet' | 'green' | 'amber' | 'rose' | 'cyan' | 'teal' | 'orange' | 'indigo' | 'pink'
export type SubjectIconKey = 'atom' | 'flask' | 'sigma' | 'shapes' | 'binary' | 'percent' | 'book' | 'languages' | 'moon' | 'globe'

export const PALETTE_KEYS: PaletteKey[] = ['blue', 'violet', 'green', 'amber', 'rose', 'cyan', 'teal', 'orange', 'indigo', 'pink']
export const SUBJECT_ICONS: SubjectIconKey[] = ['atom', 'flask', 'sigma', 'shapes', 'binary', 'percent', 'book', 'languages', 'moon', 'globe']

export type Subject = {
  id: string
  name: string
  color: PaletteKey
  icon: SubjectIconKey
  description: string
  archived: boolean
  order: number
  createdAt: string
}

export type Chapter = {
  id: string
  subjectId: string
  name: string
  order: number
  createdAt: string
}

export type TopicStatus = 'not-started' | 'learning' | 'reviewing' | 'mastered'
export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  'not-started': 'شروع نشده',
  learning: 'در حال یادگیری',
  reviewing: 'در حال مرور',
  mastered: 'مسلط',
}

export type Topic = {
  id: string
  chapterId: string
  name: string
  mastery: Mastery
  status: TopicStatus
  note: string
  createdAt: string
  updatedAt: string
}

export type StoredReviewStatus = 'pending' | 'completed' | 'rescheduled'

export type Review = {
  id: string
  subjectId: string | null
  subjectName: string
  chapterId: string | null
  chapterName: string
  topicId: string | null
  topicName: string
  firstStudiedOn: string
  dueDate: string
  type: ReviewType
  durationMin: number
  mastery: Mastery
  status: StoredReviewStatus
  completedOn: string | null
  rescheduledTo: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export type StudyDay = {
  id: string
  date: string
  hours: number
  plannedHours: number
  focus: number | null
  note: string
  createdAt: string
  updatedAt: string
}

export type TestEntry = {
  id: string
  date: string
  subjectId: string | null
  subjectName: string
  total: number
  correct: number
  wrong: number
  note: string
  createdAt: string
  updatedAt: string
}

export type ExamKind = 'mock' | 'class' | 'personal' | 'final'
export const EXAM_KIND_LABELS: Record<ExamKind, string> = {
  mock: 'آزمون آزمایشی',
  class: 'آزمون کلاس',
  personal: 'آزمون شخصی',
  final: 'آزمون جامع',
}

export type ExamResult = {
  id: string
  subjectId: string | null
  subjectName: string
  topicId: string | null
  topicName: string
  total: number
  correct: number
  wrong: number
}

export type Exam = {
  id: string
  title: string
  date: string
  kind: ExamKind
  results: ExamResult[]
  note: string
  createdAt: string
  updatedAt: string
}

export type Lesson = {
  id: string
  title: string
  order: number
  durationMin: number
  watched: boolean
  testDone: boolean
  assignmentDone: boolean
  reviewed: boolean
  mastery: Mastery
  note: string
}

export type CourseStatus = 'active' | 'completed' | 'paused'
export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  active: 'در حال یادگیری',
  completed: 'تکمیل‌شده',
  paused: 'متوقف‌شده',
}

export type Course = {
  id: string
  title: string
  subjectId: string | null
  subjectName: string
  teacher: string
  description: string
  startDate: string
  status: CourseStatus
  lessons: Lesson[]
  createdAt: string
  updatedAt: string
}

export type TaskKind = 'study' | 'test' | 'review' | 'assignment' | 'other'
export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  study: 'مطالعه',
  test: 'تست',
  review: 'مرور',
  assignment: 'تکلیف',
  other: 'سایر',
}

export type Priority = 'high' | 'medium' | 'low'
export const PRIORITY_LABELS: Record<Priority, string> = { high: 'بالا', medium: 'متوسط', low: 'کم' }

export type TaskStatus = 'open' | 'done'

export type StudyTask = {
  id: string
  title: string
  subjectId: string | null
  subjectName: string
  topicName: string
  kind: TaskKind
  createdAt: string
  dueDate: string
  priority: Priority
  difficulty: 1 | 2 | 3 | 4 | 5
  dependsOn: string | null
  status: TaskStatus
  completedAt: string | null
  order: number
  note: string
}

export type NoteLink = {
  subjectId: string | null
  chapterId: string | null
  topicId: string | null
  courseId: string | null
  examId: string | null
}

export type Note = {
  id: string
  title: string
  body: string
  category: string
  links: NoteLink
  createdAt: string
  updatedAt: string
}

export type DashboardCardId = 'today' | 'goals' | 'reviews' | 'exams' | 'courses' | 'debt'
export const DASHBOARD_CARDS: { id: DashboardCardId; label: string }[] = [
  { id: 'today', label: 'مطالعه امروز' },
  { id: 'goals', label: 'هدف مطالعه' },
  { id: 'reviews', label: 'مرورها' },
  { id: 'exams', label: 'عملکرد آزمونی' },
  { id: 'courses', label: 'دوره‌های آموزشی' },
  { id: 'debt', label: 'بدهی مطالعاتی' },
]

export type LessonWeights = { video: number; test: number; assignment: number; review: number; mastery: number }
export const DEFAULT_LESSON_WEIGHTS: LessonWeights = { video: 1, test: 1, assignment: 1, review: 1, mastery: 1 }

export type Settings = {
  theme: 'dark' | 'light'
  reduceMotion: boolean
  goals: GoalSettings
  masteryIntervals: Record<Mastery, number>
  lessonWeights: LessonWeights
  dashboardCards: { id: DashboardCardId; hidden: boolean }[]
  taskSort: 'auto' | 'manual'
  /** Preserved legacy settings so an upgrade never discards user choices. */
  legacy: { reviewIntervals?: number[]; panelOrder?: string[] }
}

export type AppState = {
  schemaVersion: typeof SCHEMA_VERSION
  subjects: Subject[]
  chapters: Chapter[]
  topics: Topic[]
  reviews: Review[]
  studyDays: StudyDay[]
  tests: TestEntry[]
  exams: Exam[]
  courses: Course[]
  tasks: StudyTask[]
  notes: Note[]
  settings: Settings
  meta: { updatedAt: string; deviceId: string }
}

export const DEFAULT_SUBJECTS: ReadonlyArray<Omit<Subject, 'createdAt'>> = [
  { id: 'sub-physics', name: 'فیزیک', color: 'blue', icon: 'atom', description: '', archived: false, order: 0 },
  { id: 'sub-chemistry', name: 'شیمی', color: 'violet', icon: 'flask', description: '', archived: false, order: 1 },
  { id: 'sub-calculus', name: 'حسابان', color: 'green', icon: 'sigma', description: '', archived: false, order: 2 },
  { id: 'sub-geometry', name: 'هندسه', color: 'amber', icon: 'shapes', description: '', archived: false, order: 3 },
  { id: 'sub-discrete', name: 'گسسته', color: 'cyan', icon: 'binary', description: '', archived: false, order: 4 },
  { id: 'sub-statistics', name: 'آمار و احتمال', color: 'teal', icon: 'percent', description: '', archived: false, order: 5 },
  { id: 'sub-persian', name: 'فارسی', color: 'rose', icon: 'book', description: '', archived: false, order: 6 },
  { id: 'sub-arabic', name: 'عربی', color: 'orange', icon: 'languages', description: '', archived: false, order: 7 },
  { id: 'sub-religion', name: 'دینی', color: 'indigo', icon: 'moon', description: '', archived: false, order: 8 },
  { id: 'sub-english', name: 'زبان انگلیسی', color: 'pink', icon: 'globe', description: '', archived: false, order: 9 },
]

export function createInitialState(deviceId = 'local', now = new Date()): AppState {
  const stamp = now.toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    subjects: DEFAULT_SUBJECTS.map(subject => ({ ...subject, createdAt: stamp })),
    chapters: [],
    topics: [],
    reviews: [],
    studyDays: [],
    tests: [],
    exams: [],
    courses: [],
    tasks: [],
    notes: [],
    settings: {
      theme: 'dark',
      reduceMotion: false,
      goals: { ...DEFAULT_GOALS },
      masteryIntervals: { ...DEFAULT_MASTERY_INTERVALS },
      lessonWeights: { ...DEFAULT_LESSON_WEIGHTS },
      dashboardCards: DASHBOARD_CARDS.map(card => ({ ...card, hidden: false })),
      taskSort: 'auto',
      legacy: {},
    },
    meta: { updatedAt: stamp, deviceId },
  }
}

/* ------------------------------------------------------------------ */
/* Safe readers                                                        */
/* ------------------------------------------------------------------ */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isoOrNull(value: unknown): string | null {
  return typeof value === 'string' && isValidISODate(value) ? value : null
}

function isoOr(value: unknown, fallback: string): string {
  return isoOrNull(value) ?? fallback
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 10) return false
  if (!isValidISODate(value.slice(0, 10))) return false
  return !Number.isNaN(Date.parse(value))
}

/** Audit timestamps keep their exact value across every sync round-trip. */
function timestampOr(value: unknown, fallback: string): string {
  return isTimestamp(value) ? value : fallback
}

function nonNegativeNumber(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : fallback
}

function nonNegativeInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : fallback
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback
}

function bool(value: unknown): boolean {
  return value === true
}

function uniqueId(value: unknown, used: Set<string>, prefix: string): string | null {
  const candidate = trimmed(value)
  if (candidate && !used.has(candidate)) {
    used.add(candidate)
    return candidate
  }
  if (candidate) return null
  const generated = `${prefix}-${used.size + 1}-${Math.random().toString(36).slice(2, 8)}`
  used.add(generated)
  return generated
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

/* ------------------------------------------------------------------ */
/* Entity normalization (v2)                                           */
/* ------------------------------------------------------------------ */

export type NormalizeResult = { state: AppState; warnings: string[]; migrated: boolean }

function normalizeSubject(raw: Record<string, unknown>, index: number, used: Set<string>, now: string): Subject | null {
  const id = uniqueId(raw.id, used, 'subject')
  const name = trimmed(raw.name)
  if (!id || !name) return null
  return {
    id,
    name: name.slice(0, 80),
    color: oneOf(raw.color, PALETTE_KEYS, 'blue'),
    icon: oneOf(raw.icon, SUBJECT_ICONS, 'book'),
    description: text(raw.description).slice(0, 400),
    archived: bool(raw.archived),
    order: nonNegativeInteger(raw.order, index, 9999),
    createdAt: timestampOr(raw.createdAt, now),
  }
}

function normalizeChapter(raw: Record<string, unknown>, index: number, used: Set<string>, now: string): Chapter | null {
  const id = uniqueId(raw.id, used, 'chapter')
  const subjectId = trimmed(raw.subjectId)
  const name = trimmed(raw.name)
  if (!id || !subjectId || !name) return null
  return {
    id,
    subjectId,
    name: name.slice(0, 120),
    order: nonNegativeInteger(raw.order, index, 9999),
    createdAt: timestampOr(raw.createdAt, now),
  }
}

function normalizeTopic(raw: Record<string, unknown>, used: Set<string>, now: string): Topic | null {
  const id = uniqueId(raw.id, used, 'topic')
  const chapterId = trimmed(raw.chapterId)
  const name = trimmed(raw.name)
  if (!id || !chapterId || !name) return null
  return {
    id,
    chapterId,
    name: name.slice(0, 160),
    mastery: isValidMastery(raw.mastery) ? raw.mastery : 'weak',
    status: oneOf<TopicStatus>(raw.status, ['not-started', 'learning', 'reviewing', 'mastered'], 'not-started'),
    note: text(raw.note).slice(0, 4000),
    createdAt: timestampOr(raw.createdAt, now),
    updatedAt: timestampOr(raw.updatedAt, isTimestamp(raw.createdAt) ? raw.createdAt : now),
  }
}

function normalizeReview(raw: Record<string, unknown>, used: Set<string>, now: string): Review | null {
  const id = uniqueId(raw.id, used, 'review')
  const subjectName = trimmed(raw.subjectName) || trimmed(raw.subject)
  const topicName = trimmed(raw.topicName) || trimmed(raw.title)
  const firstStudiedOn = isoOrNull(raw.firstStudiedOn) ?? isoOrNull(raw.baseDate)
  const dueDate = isoOrNull(raw.dueDate)
  if (!id || !subjectName || !topicName || !firstStudiedOn || !dueDate) return null
  const status = oneOf<StoredReviewStatus>(
    raw.status,
    ['pending', 'completed', 'rescheduled'],
    bool(raw.done) ? 'completed' : 'pending',
  )
  return {
    id,
    subjectId: trimmed(raw.subjectId) || null,
    subjectName: subjectName.slice(0, 120),
    chapterId: trimmed(raw.chapterId) || null,
    chapterName: text(raw.chapterName).slice(0, 160),
    topicId: trimmed(raw.topicId) || null,
    topicName: topicName.slice(0, 200),
    firstStudiedOn,
    dueDate,
    type: oneOf<ReviewType>(raw.type, ['scheduled', 'manual'], 'scheduled'),
    durationMin: nonNegativeInteger(raw.durationMin, 0, 1440),
    mastery: isValidMastery(raw.mastery) ? raw.mastery : 'medium',
    status,
    completedOn: isoOrNull(raw.completedOn) ?? isoOrNull(raw.doneAt),
    rescheduledTo: isoOrNull(raw.rescheduledTo),
    notes: text(raw.notes).slice(0, 4000),
    createdAt: timestampOr(raw.createdAt, now),
    updatedAt: timestampOr(raw.updatedAt, isTimestamp(raw.createdAt) ? raw.createdAt : now),
  }
}

function normalizeStudyDay(raw: Record<string, unknown>, index: number, used: Set<string>, now: string): StudyDay | null {
  const date = isoOrNull(raw.date)
  if (!date) return null
  const id = uniqueId(raw.id, used, 'day') ?? `day-${date}-${index}`
  return {
    id,
    date,
    hours: nonNegativeNumber(raw.hours, 0, 24),
    plannedHours: nonNegativeNumber(raw.plannedHours, 0, 24),
    focus: typeof raw.focus === 'number' && Number.isInteger(raw.focus) && raw.focus >= 0 && raw.focus <= 10 ? raw.focus : null,
    note: text(raw.note).slice(0, 2000),
    createdAt: timestampOr(raw.createdAt, now),
    updatedAt: timestampOr(raw.updatedAt, now),
  }
}

function normalizeTestEntry(raw: Record<string, unknown>, used: Set<string>, now: string): TestEntry | null {
  const id = uniqueId(raw.id, used, 'test')
  const date = isoOrNull(raw.date)
  const subjectName = trimmed(raw.subjectName)
  const total = nonNegativeInteger(raw.total, -1, 10000)
  const correct = nonNegativeInteger(raw.correct, -1, 10000)
  const wrong = nonNegativeInteger(raw.wrong, -1, 10000)
  if (!id || !date || !subjectName || total < 0 || correct < 0 || wrong < 0) return null
  if (correct + wrong > total) return null
  return {
    id,
    date,
    subjectId: trimmed(raw.subjectId) || null,
    subjectName: subjectName.slice(0, 120),
    total,
    correct,
    wrong,
    note: text(raw.note).slice(0, 1000),
    createdAt: timestampOr(raw.createdAt, now),
    updatedAt: timestampOr(raw.updatedAt, now),
  }
}

function normalizeExamResult(raw: Record<string, unknown>, used: Set<string>): ExamResult | null {
  const id = uniqueId(raw.id, used, 'result')
  const subjectName = trimmed(raw.subjectName)
  const total = nonNegativeInteger(raw.total, -1, 10000)
  const correct = nonNegativeInteger(raw.correct, -1, 10000)
  const wrong = nonNegativeInteger(raw.wrong, -1, 10000)
  if (!id || !subjectName || total <= 0 || correct < 0 || wrong < 0 || correct + wrong > total) return null
  return {
    id,
    subjectId: trimmed(raw.subjectId) || null,
    subjectName: subjectName.slice(0, 120),
    topicId: trimmed(raw.topicId) || null,
    topicName: text(raw.topicName).slice(0, 200),
    total, correct, wrong,
  }
}

function normalizeExam(raw: Record<string, unknown>, used: Set<string>, now: string): Exam | null {
  const id = uniqueId(raw.id, used, 'exam')
  const title = trimmed(raw.title)
  const date = isoOrNull(raw.date)
  if (!id || !title || !date) return null
  const resultIds = new Set<string>()
  const results = records(raw.results)
    .map(result => normalizeExamResult(result, resultIds))
    .filter((result): result is ExamResult => result !== null)
  return {
    id,
    title: title.slice(0, 160),
    date,
    kind: oneOf<ExamKind>(raw.kind, ['mock', 'class', 'personal', 'final'], 'personal'),
    results,
    note: text(raw.note).slice(0, 4000),
    createdAt: timestampOr(raw.createdAt, now),
    updatedAt: timestampOr(raw.updatedAt, now),
  }
}

function normalizeLesson(raw: Record<string, unknown>, index: number, used: Set<string>): Lesson | null {
  const id = uniqueId(raw.id, used, 'lesson')
  const title = trimmed(raw.title)
  if (!id || !title) return null
  return {
    id,
    title: title.slice(0, 200),
    order: nonNegativeInteger(raw.order, index, 9999),
    durationMin: nonNegativeInteger(raw.durationMin, 0, 1440),
    watched: bool(raw.watched),
    testDone: bool(raw.testDone),
    assignmentDone: bool(raw.assignmentDone),
    reviewed: bool(raw.reviewed),
    mastery: isValidMastery(raw.mastery) ? raw.mastery : 'weak',
    note: text(raw.note).slice(0, 4000),
  }
}

function normalizeCourse(raw: Record<string, unknown>, used: Set<string>, now: string): Course | null {
  const id = uniqueId(raw.id, used, 'course')
  const title = trimmed(raw.title)
  if (!id || !title) return null
  const lessonIds = new Set<string>()
  return {
    id,
    title: title.slice(0, 200),
    subjectId: trimmed(raw.subjectId) || null,
    subjectName: text(raw.subjectName).slice(0, 120),
    teacher: text(raw.teacher).slice(0, 120),
    description: text(raw.description).slice(0, 4000),
    startDate: isoOr(raw.startDate, now.slice(0, 10)),
    status: oneOf<CourseStatus>(raw.status, ['active', 'completed', 'paused'], 'active'),
    lessons: records(raw.lessons)
      .map((lesson, index) => normalizeLesson(lesson, index, lessonIds))
      .filter((lesson): lesson is Lesson => lesson !== null),
    createdAt: timestampOr(raw.createdAt, now),
    updatedAt: timestampOr(raw.updatedAt, now),
  }
}

function normalizeTask(raw: Record<string, unknown>, index: number, used: Set<string>, now: string): StudyTask | null {
  const id = uniqueId(raw.id, used, 'task')
  const title = trimmed(raw.title)
  const dueDate = isoOrNull(raw.dueDate)
  if (!id || !title || !dueDate) return null
  const difficulty = nonNegativeInteger(raw.difficulty, 3, 5)
  return {
    id,
    title: title.slice(0, 200),
    subjectId: trimmed(raw.subjectId) || null,
    subjectName: text(raw.subjectName).slice(0, 120),
    topicName: text(raw.topicName).slice(0, 200),
    kind: oneOf<TaskKind>(raw.kind, ['study', 'test', 'review', 'assignment', 'other'], 'study'),
    createdAt: timestampOr(raw.createdAt, now),
    dueDate,
    priority: oneOf<Priority>(raw.priority, ['high', 'medium', 'low'], 'medium'),
    difficulty: (difficulty < 1 ? 1 : difficulty) as 1 | 2 | 3 | 4 | 5,
    dependsOn: trimmed(raw.dependsOn) || null,
    status: oneOf<TaskStatus>(raw.status, ['open', 'done'], 'open'),
    completedAt: isoOrNull(raw.completedAt),
    order: nonNegativeInteger(raw.order, index, 9999),
    note: text(raw.note).slice(0, 2000),
  }
}

function normalizeNote(raw: Record<string, unknown>, used: Set<string>, now: string): Note | null {
  const id = uniqueId(raw.id, used, 'note')
  const title = trimmed(raw.title)
  if (!id || !title) return null
  const links = isRecord(raw.links) ? raw.links : {}
  return {
    id,
    title: title.slice(0, 200),
    body: text(raw.body).slice(0, 50000),
    category: text(raw.category, 'عمومی').slice(0, 80) || 'عمومی',
    links: {
      subjectId: trimmed(links.subjectId) || null,
      chapterId: trimmed(links.chapterId) || null,
      topicId: trimmed(links.topicId) || null,
      courseId: trimmed(links.courseId) || null,
      examId: trimmed(links.examId) || null,
    },
    createdAt: timestampOr(raw.createdAt, now),
    updatedAt: timestampOr(raw.updatedAt, now),
  }
}

function normalizeSettings(raw: unknown, now: string): Settings {
  const base = createInitialState('local', new Date(now)).settings
  if (!isRecord(raw)) return base
  const goalCandidate = isRecord(raw.goals) ? raw.goals : {}
  const goals = isValidGoalSettings(goalCandidate)
    ? { dailyHours: goalCandidate.dailyHours, weeklyHours: goalCandidate.weeklyHours, monthlyHours: goalCandidate.monthlyHours }
    : {
        dailyHours: nonNegativeNumber(goalCandidate.dailyHours, base.goals.dailyHours, 24),
        weeklyHours: nonNegativeNumber(goalCandidate.weeklyHours, base.goals.weeklyHours, 168),
        monthlyHours: nonNegativeNumber(goalCandidate.monthlyHours, base.goals.monthlyHours, 744),
      }

  const cardsRaw = Array.isArray(raw.dashboardCards) ? raw.dashboardCards : []
  const seen = new Set<DashboardCardId>()
  const cards: { id: DashboardCardId; hidden: boolean }[] = []
  for (const card of cardsRaw) {
    if (!isRecord(card)) continue
    const id = oneOf<DashboardCardId>(card.id, DASHBOARD_CARDS.map(item => item.id), 'today')
    if (seen.has(id)) continue
    seen.add(id)
    cards.push({ id, hidden: bool(card.hidden) })
  }
  for (const card of base.dashboardCards) if (!seen.has(card.id)) cards.push({ ...card })

  const weightsRaw = isRecord(raw.lessonWeights) ? raw.lessonWeights : {}
  const weight = (key: keyof LessonWeights) => {
    const value = weightsRaw[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 ? value : DEFAULT_LESSON_WEIGHTS[key]
  }

  const legacyRaw = isRecord(raw.legacy) ? raw.legacy : {}
  const legacyIntervals = Array.isArray(legacyRaw.reviewIntervals)
    ? legacyRaw.reviewIntervals.filter((item): item is number => typeof item === 'number' && Number.isInteger(item) && item > 0 && item <= 365)
    : undefined
  const legacyPanels = Array.isArray(legacyRaw.panelOrder)
    ? legacyRaw.panelOrder.filter((item): item is string => typeof item === 'string')
    : undefined

  return {
    theme: oneOf(raw.theme, ['dark', 'light'] as const, 'dark'),
    reduceMotion: bool(raw.reduceMotion),
    goals,
    masteryIntervals: isValidMasteryIntervals(raw.masteryIntervals) ? { ...raw.masteryIntervals } : { ...DEFAULT_MASTERY_INTERVALS },
    lessonWeights: { video: weight('video'), test: weight('test'), assignment: weight('assignment'), review: weight('review'), mastery: weight('mastery') },
    dashboardCards: cards,
    taskSort: oneOf(raw.taskSort, ['auto', 'manual'] as const, 'auto'),
    legacy: {
      ...(legacyIntervals && legacyIntervals.length ? { reviewIntervals: legacyIntervals } : {}),
      ...(legacyPanels && legacyPanels.length ? { panelOrder: legacyPanels } : {}),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Legacy v1 migration                                                  */
/* ------------------------------------------------------------------ */

function migrateLegacyState(raw: Record<string, unknown>, deviceId: string, now: string): NormalizeResult {
  const warnings: string[] = []
  const states = createInitialState(deviceId, new Date(now))

  for (const item of records(raw.reviews)) {
    const id = trimmed(item.id)
    const subject = trimmed(item.subject)
    const title = trimmed(item.title)
    const baseDate = isoOrNull(item.baseDate)
    const dueDate = isoOrNull(item.dueDate)
    if (!id || !subject || !title || !baseDate || !dueDate) {
      warnings.push('یک مرور قدیمی ساختار معتبر نداشت و منتقل نشد.')
      continue
    }
    const done = bool(item.done)
    states.reviews.push({
      id,
      subjectId: null,
      subjectName: subject,
      chapterId: null,
      chapterName: '',
      topicId: null,
      topicName: title,
      firstStudiedOn: baseDate,
      dueDate,
      type: 'scheduled',
      durationMin: 0,
      mastery: 'medium',
      status: done ? 'completed' : 'pending',
      completedOn: isoOrNull(item.doneAt),
      rescheduledTo: null,
      notes: text(item.stage),
      createdAt: now,
      updatedAt: now,
    })
  }

  for (const record of records(raw.performance)) {
    const date = isoOrNull(record.date)
    if (!date) {
      warnings.push('یک رکورد عملکرد قدیمی تاریخ معتبر نداشت و منتقل نشد.')
      continue
    }
    const createdAt = timestampOr(record.createdAt, `${date}T00:00:00.000Z`)
    states.studyDays.push({
      id: `day-${date}`,
      date,
      hours: nonNegativeNumber(record.hours, 0, 24),
      plannedHours: nonNegativeNumber(record.planned, 0, 24),
      focus: typeof record.focus === 'number' && Number.isInteger(record.focus) && record.focus >= 0 && record.focus <= 10 ? record.focus : null,
      note: '',
      createdAt,
      updatedAt: createdAt,
    })
    const exams = records(record.exams)
    exams.forEach((exam, index) => {
      const subjectName = trimmed(exam.subject)
      const total = nonNegativeInteger(exam.tests, -1, 10000)
      const correct = nonNegativeInteger(exam.correct, -1, 10000)
      const wrong = nonNegativeInteger(exam.wrong, -1, 10000)
      if (!subjectName || total < 0 || correct < 0 || wrong < 0 || correct + wrong > total) {
        warnings.push('یک آمار درس از دادهٔ قدیمی معتبر نبود و منتقل نشد.')
        return
      }
      if (total === 0) return
      states.tests.push({
        id: `${text(record.id, `perf-${date}`)}-${index}`,
        date,
        subjectId: null,
        subjectName,
        total, correct, wrong,
        note: '',
        createdAt,
        updatedAt: createdAt,
      })
    })
  }

  const goals = isRecord(raw.studyGoals)
    ? {
        dailyHours: DEFAULT_GOALS.dailyHours,
        weeklyHours: nonNegativeNumber(raw.studyGoals.weeklyHours, DEFAULT_GOALS.weeklyHours, 168),
        monthlyHours: nonNegativeNumber(raw.studyGoals.monthlyHours, DEFAULT_GOALS.monthlyHours, 744),
      }
    : { ...DEFAULT_GOALS }

  const intervals = Array.isArray(raw.intervals)
    ? raw.intervals.filter((item): item is number => typeof item === 'number' && Number.isInteger(item) && item > 0 && item <= 365)
    : []
  const panelOrder = Array.isArray(raw.panelOrder)
    ? raw.panelOrder.filter((item): item is string => typeof item === 'string')
    : []

  states.settings = {
    ...states.settings,
    theme: oneOf(raw.theme, ['dark', 'light'] as const, 'dark'),
    reduceMotion: bool(raw.reduceMotion),
    goals,
    legacy: {
      ...(intervals.length ? { reviewIntervals: intervals } : {}),
      ...(panelOrder.length ? { panelOrder } : {}),
    },
  }
  states.meta = { updatedAt: now, deviceId }

  warnings.push('اطلاعات نسخهٔ قبلی بدون حذف داده به ساختار جدید منتقل شد.')
  return { state: states, warnings, migrated: true }
}

/* ------------------------------------------------------------------ */
/* Public normalization                                                 */
/* ------------------------------------------------------------------ */

export function normalizeState(input: unknown, deviceId = 'local', now = new Date().toISOString()): NormalizeResult | null {
  if (!isRecord(input)) return null
  if (input.version === 1) return migrateLegacyState(input, deviceId, now)
  if (input.schemaVersion !== SCHEMA_VERSION && input.version !== SCHEMA_VERSION) return null
  if (!Array.isArray(input.subjects) || !Array.isArray(input.reviews) || !Array.isArray(input.studyDays)) return null

  const warnings: string[] = []
  const state = createInitialState(deviceId, new Date(now))

  const subjectIds = new Set<string>()
  state.subjects = records(input.subjects)
    .map((raw, index) => normalizeSubject(raw, index, subjectIds, now))
    .filter((subject): subject is Subject => subject !== null)

  const chapterIds = new Set<string>()
  state.chapters = records(input.chapters)
    .map((raw, index) => normalizeChapter(raw, index, chapterIds, now))
    .filter((chapter): chapter is Chapter => chapter !== null)
    .filter(chapter => subjectIds.has(chapter.subjectId))

  const topicIds = new Set<string>()
  state.topics = records(input.topics)
    .map(raw => normalizeTopic(raw, topicIds, now))
    .filter((topic): topic is Topic => topic !== null)
    .filter(topic => chapterIds.has(topic.chapterId))

  const reviewIds = new Set<string>()
  state.reviews = records(input.reviews)
    .map(raw => normalizeReview(raw, reviewIds, now))
    .filter((review): review is Review => review !== null)

  const dayIds = new Set<string>()
  state.studyDays = records(input.studyDays)
    .map((raw, index) => normalizeStudyDay(raw, index, dayIds, now))
    .filter((day): day is StudyDay => day !== null)
  // One study day per date keeps day totals unambiguous.
  const seenDates = new Set<string>()
  state.studyDays = state.studyDays.filter(day => {
    if (seenDates.has(day.date)) {
      warnings.push(`رکورد تکراری برای تاریخ ${day.date} ادغام شد.`)
      return false
    }
    seenDates.add(day.date)
    return true
  })

  const testIds = new Set<string>()
  state.tests = records(input.tests)
    .map(raw => normalizeTestEntry(raw, testIds, now))
    .filter((entry): entry is TestEntry => entry !== null)

  const examIds = new Set<string>()
  state.exams = records(input.exams)
    .map(raw => normalizeExam(raw, examIds, now))
    .filter((exam): exam is Exam => exam !== null)

  const courseIds = new Set<string>()
  state.courses = records(input.courses)
    .map(raw => normalizeCourse(raw, courseIds, now))
    .filter((course): course is Course => course !== null)

  const taskIds = new Set<string>()
  state.tasks = records(input.tasks)
    .map((raw, index) => normalizeTask(raw, index, taskIds, now))
    .filter((task): task is StudyTask => task !== null)

  const noteIds = new Set<string>()
  state.notes = records(input.notes)
    .map(raw => normalizeNote(raw, noteIds, now))
    .filter((note): note is Note => note !== null)

  state.settings = normalizeSettings(input.settings, now)
  state.meta = {
    updatedAt: text(isRecord(input.meta) ? input.meta.updatedAt : '', now),
    deviceId: trimmed(isRecord(input.meta) ? input.meta.deviceId : '') || deviceId,
  }

  const droppedReviews = records(input.reviews).length - state.reviews.length
  if (droppedReviews > 0) warnings.push(`${droppedReviews} مرور با ساختار نامعتبر نادیده گرفته شد.`)
  return { state, warnings, migrated: false }
}

export function serializeState(state: AppState): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    version: SCHEMA_VERSION,
    subjects: state.subjects,
    chapters: state.chapters,
    topics: state.topics,
    reviews: state.reviews,
    studyDays: state.studyDays,
    tests: state.tests,
    exams: state.exams,
    courses: state.courses,
    tasks: state.tasks,
    notes: state.notes,
    settings: state.settings,
    meta: state.meta,
  }
}

/* ------------------------------------------------------------------ */
/* Lookup helpers                                                       */
/* ------------------------------------------------------------------ */

export function subjectName(state: Pick<AppState, 'subjects'>, id: string | null | undefined): string {
  if (!id) return ''
  return state.subjects.find(subject => subject.id === id)?.name ?? ''
}

export function chapterOf(state: AppState, chapterId: string | null | undefined): Chapter | undefined {
  return chapterId ? state.chapters.find(chapter => chapter.id === chapterId) : undefined
}

export function topicOf(state: AppState, topicId: string | null | undefined): Topic | undefined {
  return topicId ? state.topics.find(topic => topic.id === topicId) : undefined
}

export function activeSubjectNames(state: AppState): string[] {
  const names = new Set(state.subjects.filter(subject => !subject.archived).map(subject => subject.name))
  for (const review of state.reviews) names.add(review.subjectName)
  for (const test of state.tests) names.add(test.subjectName)
  for (const exam of state.exams) for (const result of exam.results) names.add(result.subjectName)
  return [...names].filter(Boolean)
}

export function ensureSubject(state: AppState, name: string, now: string): { state: AppState; id: string } {
  const clean = name.trim()
  const existing = state.subjects.find(subject => subject.name === clean)
  if (existing) return { state, id: existing.id }
  const id = `subject-${clean.replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`
  const subject: Subject = {
    id,
    name: clean,
    color: PALETTE_KEYS[state.subjects.length % PALETTE_KEYS.length],
    icon: 'book',
    description: '',
    archived: false,
    order: state.subjects.length,
    createdAt: now,
  }
  return { state: { ...state, subjects: [...state.subjects, subject] }, id }
}

export function currentWeekStart(today: string): string {
  return startOfWeekISO(today)
}

export function masteryLevelOrder(): Mastery[] {
  return [...MASTERY_LEVELS]
}

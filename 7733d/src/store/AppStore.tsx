import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createId } from '../lib/id.js'
import {
  createInitialState, normalizeState, serializeState,
  type AppState, type CourseStatus, type DashboardCardId, type Exam, type ExamKind,
  type ExamResult, type Lesson, type LessonWeights, type Note, type NoteLink, type PaletteKey,
  type Priority, type Review, type Settings, type StudyTask, type SubjectIconKey, type TaskKind,
  type TestEntry, type Topic, type TopicStatus, type StudyDay,
} from '../lib/model.js'
import { nextReviewDate, type Mastery } from '../lib/review.js'
import { shiftTaskOrder } from '../lib/tasks.js'
import { mergeImportedState, type MergeSummary } from '../lib/backup.js'
import type { GoalSettings } from '../lib/goals.js'
import { fromCloudPayload, loadCloudState, mergeAppStates, saveCloudState } from '../lib/sync.js'
import { cloudConfigured, supabase } from '../cloud.js'
import { todayISOInTehran, serverTodayISO } from '../lib/date.js'
import { deviceId as resolveDeviceId } from '../lib/id.js'

const LOCAL_STATE_KEY = 'moroor-state-v2'
const SYNCED_KEY_PREFIX = 'moroor-synced-v2:'
const LAST_USER_KEY = 'moroor-last-user-v2'
const LEGACY_KEYS = {
  reviews: 'moroor-reviews-v4',
  performance: 'moroor-performance-v1',
  intervals: 'moroor-review-intervals-v1',
  panelOrder: 'moroor-panel-order-v3',
  reduceMotion: 'moroor-reduced-motion-v1',
  goals: 'moroor-study-goals-v1',
  theme: 'moroor-theme',
}

export type SyncStatus = 'local' | 'loading' | 'saving' | 'synced' | 'error' | 'offline'
export type ToastTone = 'success' | 'error' | 'info' | 'warning'
export type Toast = { id: string; message: string; tone: ToastTone; details?: string[] }

export type SyncInfo = {
  status: SyncStatus
  lastSyncedAt: string | null
  error: string
  conflicts: string[]
  pending: boolean
  retry: () => void
}

type Update = (mutator: (state: AppState) => AppState) => void

export type ReviewInput = {
  subjectId: string | null
  subjectName: string
  chapterId: string | null
  chapterName: string
  topicId: string | null
  topicName: string
  firstStudiedOn: string
  dueDate: string
  mastery: Mastery
  durationMin: number
  notes: string
}

export type ReviewCompletion = {
  completedOn: string
  mastery: Mastery
  durationMin: number
  notes: string
  scheduleNext: boolean
  nextDueDate?: string
}

export type DailyTestRow = {
  id?: string
  subjectId: string | null
  subjectName: string
  total: number
  correct: number
  wrong: number
  note?: string
}

export type CourseInput = {
  title: string
  subjectId: string | null
  subjectName: string
  teacher: string
  description: string
  startDate: string
  status: CourseStatus
}

export type TaskInput = {
  title: string
  subjectId: string | null
  subjectName: string
  topicName: string
  kind: TaskKind
  dueDate: string
  priority: Priority
  difficulty: 1 | 2 | 3 | 4 | 5
  dependsOn: string | null
  note: string
}

export type Actions = {
  setSettings: (patch: Partial<Settings>) => void
  setGoals: (goals: GoalSettings) => void
  setTheme: (theme: 'dark' | 'light') => void
  toggleDashboardCard: (id: DashboardCardId) => void
  moveDashboardCard: (id: DashboardCardId, direction: 'up' | 'down') => void
  addSubject: (input: { name: string; color: PaletteKey; icon: SubjectIconKey; description: string }) => string
  updateSubject: (id: string, patch: Partial<{ name: string; color: PaletteKey; icon: SubjectIconKey; description: string; archived: boolean }>) => void
  addChapter: (subjectId: string, name: string) => string
  updateChapter: (id: string, name: string) => void
  removeChapter: (id: string) => void
  addTopic: (input: { chapterId: string; name: string; mastery: Mastery; status: TopicStatus; note: string }) => string
  updateTopic: (id: string, patch: Partial<Pick<Topic, 'name' | 'mastery' | 'status' | 'note'>>) => void
  removeTopic: (id: string) => void
  createReview: (input: ReviewInput) => string
  completeReview: (id: string, completion: ReviewCompletion) => void
  rescheduleReview: (id: string, dueDate: string) => void
  removeReview: (id: string) => void
  saveStudyDay: (date: string, input: { hours: number; plannedHours: number; focus: number | null; note: string }) => void
  removeStudyDay: (date: string) => void
  removeDay: (date: string) => void
  saveDailyTests: (date: string, rows: DailyTestRow[]) => void
  removeTest: (id: string) => void
  addExam: (input: { title: string; date: string; kind: ExamKind; results: ExamResult[]; note: string }) => string
  updateExam: (id: string, patch: Partial<Pick<Exam, 'title' | 'date' | 'kind' | 'note' | 'results'>>) => void
  removeExam: (id: string) => void
  addCourse: (input: CourseInput) => string
  updateCourse: (id: string, patch: Partial<CourseInput>) => void
  removeCourse: (id: string) => void
  addLesson: (courseId: string, input: { title: string; durationMin: number }) => void
  updateLesson: (courseId: string, lessonId: string, patch: Partial<Lesson>) => void
  removeLesson: (courseId: string, lessonId: string) => void
  toggleLessonStep: (courseId: string, lessonId: string, step: 'watched' | 'testDone' | 'assignmentDone' | 'reviewed', value: boolean) => void
  addTask: (input: TaskInput) => string
  updateTask: (id: string, patch: Partial<StudyTask>) => void
  removeTask: (id: string) => void
  toggleTaskDone: (id: string, done: boolean) => void
  moveTask: (id: string, direction: 'up' | 'down') => void
  addNote: (input: { title: string; body: string; category: string; links: NoteLink }) => string
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'category' | 'links'>>) => void
  removeNote: (id: string) => void
  applyImport: (incoming: AppState, includeSettings: boolean) => MergeSummary
  updateLessonWeights: (weights: LessonWeights) => void
}

type StoreValue = {
  state: AppState
  today: string
  actions: Actions
  sync: SyncInfo
  toasts: Toast[]
  notify: (message: string, tone?: ToastTone, details?: string[]) => void
  dismissToast: (id: string) => void
  userId: string | null
  localMode: boolean
}

const StoreContext = createContext<StoreValue | null>(null)

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function readLegacyLocalState(device: string): AppState | null {
  try {
    const reviews = readJson(LEGACY_KEYS.reviews)
    const performance = readJson(LEGACY_KEYS.performance)
    if (!Array.isArray(reviews) && !Array.isArray(performance)) return null
    const legacy = {
      version: 1,
      reviews: Array.isArray(reviews) ? reviews : [],
      performance: Array.isArray(performance) ? performance : [],
      intervals: readJson(LEGACY_KEYS.intervals) ?? [1, 3, 7, 30, 90],
      panelOrder: readJson(LEGACY_KEYS.panelOrder) ?? [],
      reduceMotion: readJson(LEGACY_KEYS.reduceMotion) === true,
      studyGoals: readJson(LEGACY_KEYS.goals) ?? { weeklyHours: 35, monthlyHours: 150 },
      theme: localStorage.getItem(LEGACY_KEYS.theme) === 'light' ? 'light' : 'dark',
    }
    const normalized = normalizeState(legacy, device)
    return normalized ? normalized.state : null
  } catch {
    return null
  }
}

function readLocalState(device: string): AppState {
  const stored = readJson(LOCAL_STATE_KEY)
  const normalized = stored ? normalizeState(stored, device) : null
  if (normalized) return normalized.state
  return readLegacyLocalState(device) ?? createInitialState(device)
}

function writeLocalState(state: AppState): void {
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(serializeState(state)))
  } catch {
    /* storage may be full or disabled; the cloud copy remains */
  }
}

function readSyncedState(userId: string, device: string): AppState | null {
  const stored = readJson(`${SYNCED_KEY_PREFIX}${userId}`)
  if (!stored) return null
  const normalized = normalizeState(stored, device)
  return normalized ? normalized.state : null
}

function writeSyncedState(userId: string, state: AppState): void {
  try {
    localStorage.setItem(`${SYNCED_KEY_PREFIX}${userId}`, JSON.stringify(serializeState(state)))
  } catch {
    /* optional cache */
  }
}

function withTimestamp(state: AppState, now: string): AppState {
  return { ...state, meta: { ...state.meta, updatedAt: now } }
}

export function AppStoreProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const device = useMemo(() => resolveDeviceId(), [])
  const [state, setState] = useState<AppState>(() => readLocalState(device))
  const [today, setToday] = useState<string>(() => todayISOInTehran())
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sync, setSync] = useState<SyncInfo>(() => ({
    status: cloudConfigured() ? 'loading' : 'local',
    lastSyncedAt: null,
    error: '',
    conflicts: [],
    pending: false,
    retry: () => undefined,
  }))
  const baselineRef = useRef<AppState | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const savingRef = useRef(false)
  const queuedRef = useRef(false)
  const aliveRef = useRef(true)

  const notify = useCallback((message: string, tone: ToastTone = 'info', details?: string[]) => {
    const id = createId('toast')
    setToasts(current => [...current.slice(-3), { id, message, tone, details }])
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 6500)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  useEffect(() => {
    const refresh = () => setToday(todayISOInTehran())
    const interval = window.setInterval(refresh, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    const syncServerDate = async () => {
      try {
        const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
        const serverToday = serverTodayISO(response.headers.get('Date'))
        if (serverToday) setToday(serverToday)
      } catch {
        /* offline: device clock stands in */
      }
    }
    void syncServerDate()
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const update = useCallback<Update>(mutator => {
    setState(current => {
      const next = mutator(current)
      return withTimestamp(next, new Date().toISOString())
    })
  }, [])

  const actions = useMemo<Actions>(() => {
    const now = () => new Date().toISOString()
    return {
      setSettings: patch => update(current => ({ ...current, settings: { ...current.settings, ...patch } })),
      setGoals: goals => update(current => ({ ...current, settings: { ...current.settings, goals } })),
      setTheme: theme => update(current => ({ ...current, settings: { ...current.settings, theme } })),
      toggleDashboardCard: id => update(current => ({
        ...current,
        settings: {
          ...current.settings,
          dashboardCards: current.settings.dashboardCards.map(card => card.id === id ? { ...card, hidden: !card.hidden } : card),
        },
      })),
      moveDashboardCard: (id, direction) => update(current => {
        const cards = [...current.settings.dashboardCards]
        const index = cards.findIndex(card => card.id === id)
        const target = direction === 'up' ? index - 1 : index + 1
        if (index < 0 || target < 0 || target >= cards.length) return current
        const [moved] = cards.splice(index, 1)
        cards.splice(target, 0, moved)
        return { ...current, settings: { ...current.settings, dashboardCards: cards } }
      }),

      addSubject: input => {
        const id = createId('subject')
        update(current => ({
          ...current,
          subjects: [...current.subjects, {
            id,
            name: input.name.trim(),
            color: input.color,
            icon: input.icon,
            description: input.description.trim(),
            archived: false,
            order: current.subjects.length,
            createdAt: now(),
          }],
        }))
        return id
      },
      updateSubject: (id, patch) => update(current => ({
        ...current,
        subjects: current.subjects.map(subject => subject.id === id ? { ...subject, ...patch } : subject),
      })),

      addChapter: (subjectId, name) => {
        const id = createId('chapter')
        update(current => ({
          ...current,
          chapters: [...current.chapters, {
            id,
            subjectId,
            name: name.trim(),
            order: current.chapters.filter(chapter => chapter.subjectId === subjectId).length,
            createdAt: now(),
          }],
        }))
        return id
      },
      updateChapter: (id, name) => update(current => ({
        ...current,
        chapters: current.chapters.map(chapter => chapter.id === id ? { ...chapter, name: name.trim() } : chapter),
      })),
      removeChapter: id => update(current => {
        const topicIds = new Set(current.topics.filter(topic => topic.chapterId === id).map(topic => topic.id))
        return {
          ...current,
          chapters: current.chapters.filter(chapter => chapter.id !== id),
          topics: current.topics.filter(topic => topic.chapterId !== id),
          reviews: current.reviews.map(review => review.chapterId === id
            ? { ...review, chapterId: null, topicId: review.topicId && topicIds.has(review.topicId) ? null : review.topicId }
            : review),
        }
      }),

      addTopic: input => {
        const id = createId('topic')
        update(current => ({
          ...current,
          topics: [...current.topics, {
            id,
            chapterId: input.chapterId,
            name: input.name.trim(),
            mastery: input.mastery,
            status: input.status,
            note: input.note,
            createdAt: now(),
            updatedAt: now(),
          }],
        }))
        return id
      },
      updateTopic: (id, patch) => update(current => ({
        ...current,
        topics: current.topics.map(topic => topic.id === id ? { ...topic, ...patch, updatedAt: now() } : topic),
      })),
      removeTopic: id => update(current => ({
        ...current,
        topics: current.topics.filter(topic => topic.id !== id),
        reviews: current.reviews.map(review => review.topicId === id ? { ...review, topicId: null } : review),
      })),

      createReview: input => {
        const id = createId('review')
        update(current => ({
          ...current,
          reviews: [...current.reviews, {
            id,
            subjectId: input.subjectId,
            subjectName: input.subjectName.trim(),
            chapterId: input.chapterId,
            chapterName: input.chapterName.trim(),
            topicId: input.topicId,
            topicName: input.topicName.trim(),
            firstStudiedOn: input.firstStudiedOn,
            dueDate: input.dueDate,
            type: 'scheduled',
            durationMin: input.durationMin,
            mastery: input.mastery,
            status: 'pending',
            completedOn: null,
            rescheduledTo: null,
            notes: input.notes,
            createdAt: now(),
            updatedAt: now(),
          }],
        }))
        return id
      },
      completeReview: (id, completion) => update(current => {
        const review = current.reviews.find(item => item.id === id)
        if (!review) return current
        const timestamp = now()
        let reviews = current.reviews.map(item => item.id === id
          ? {
              ...item,
              status: 'completed' as const,
              completedOn: completion.completedOn,
              mastery: completion.mastery,
              durationMin: completion.durationMin,
              notes: completion.notes,
              updatedAt: timestamp,
            }
          : item)
        if (completion.scheduleNext) {
          const nextDue = completion.nextDueDate ?? nextReviewDate(completion.completedOn, completion.mastery, current.settings.masteryIntervals)
          const next: Review = {
            ...review,
            id: createId('review'),
            firstStudiedOn: review.firstStudiedOn,
            dueDate: nextDue,
            status: 'pending',
            completedOn: null,
            rescheduledTo: null,
            durationMin: completion.durationMin,
            mastery: completion.mastery,
            notes: '',
            createdAt: timestamp,
            updatedAt: timestamp,
          }
          reviews = [...reviews, next]
        }
        const topics = review.topicId
          ? current.topics.map(topic => topic.id === review.topicId
              ? {
                  ...topic,
                  mastery: completion.mastery,
                  status: completion.mastery === 'excellent' ? 'mastered' as const : 'reviewing' as const,
                  updatedAt: timestamp,
                }
              : topic)
          : current.topics
        return { ...current, reviews, topics }
      }),
      rescheduleReview: (id, dueDate) => update(current => ({
        ...current,
        reviews: current.reviews.map(review => review.id === id
          ? { ...review, dueDate, status: 'rescheduled', rescheduledTo: dueDate, updatedAt: now() }
          : review),
      })),
      removeReview: id => update(current => ({ ...current, reviews: current.reviews.filter(review => review.id !== id) })),

      saveStudyDay: (date, input) => update(current => {
        const id = `day-${date}`
        const existing = current.studyDays.find(day => day.date === date)
        const entry: StudyDay = {
          id: existing?.id ?? id,
          date,
          hours: input.hours,
          plannedHours: input.plannedHours,
          focus: input.focus,
          note: input.note,
          createdAt: existing?.createdAt ?? now(),
          updatedAt: now(),
        }
        const others = current.studyDays.filter(day => day.date !== date)
        return { ...current, studyDays: [...others, entry].sort((a, b) => a.date.localeCompare(b.date)) }
      }),
      removeStudyDay: date => update(current => ({ ...current, studyDays: current.studyDays.filter(day => day.date !== date) })),
      removeDay: date => update(current => ({
        ...current,
        studyDays: current.studyDays.filter(day => day.date !== date),
        tests: current.tests.filter(test => test.date !== date),
      })),

      saveDailyTests: (date, rows) => update(current => {
        const existing = current.tests.filter(test => test.date === date)
        const next: TestEntry[] = rows.map(row => {
          const match = existing.find(test => test.subjectName === row.subjectName)
          return {
            id: match?.id ?? row.id ?? createId('test'),
            date,
            subjectId: row.subjectId,
            subjectName: row.subjectName,
            total: row.total,
            correct: row.correct,
            wrong: row.wrong,
            note: row.note ?? '',
            createdAt: match?.createdAt ?? now(),
            updatedAt: now(),
          }
        })
        return { ...current, tests: [...current.tests.filter(test => test.date !== date), ...next] }
      }),
      removeTest: id => update(current => ({ ...current, tests: current.tests.filter(test => test.id !== id) })),

      addExam: input => {
        const id = createId('exam')
        update(current => ({
          ...current,
          exams: [...current.exams, {
            id,
            title: input.title.trim(),
            date: input.date,
            kind: input.kind,
            results: input.results,
            note: input.note,
            createdAt: now(),
            updatedAt: now(),
          }],
        }))
        return id
      },
      updateExam: (id, patch) => update(current => ({
        ...current,
        exams: current.exams.map(exam => exam.id === id ? { ...exam, ...patch, updatedAt: now() } : exam),
      })),
      removeExam: id => update(current => ({ ...current, exams: current.exams.filter(exam => exam.id !== id) })),

      addCourse: input => {
        const id = createId('course')
        update(current => ({
          ...current,
          courses: [...current.courses, {
            id,
            ...input,
            lessons: [],
            createdAt: now(),
            updatedAt: now(),
          }],
        }))
        return id
      },
      updateCourse: (id, patch) => update(current => ({
        ...current,
        courses: current.courses.map(course => course.id === id ? { ...course, ...patch, updatedAt: now() } : course),
      })),
      removeCourse: id => update(current => ({ ...current, courses: current.courses.filter(course => course.id !== id) })),
      addLesson: (courseId, input) => update(current => ({
        ...current,
        courses: current.courses.map(course => course.id === courseId
          ? {
              ...course,
              lessons: [...course.lessons, {
                id: createId('lesson'),
                title: input.title.trim(),
                order: course.lessons.length,
                durationMin: input.durationMin,
                watched: false,
                testDone: false,
                assignmentDone: false,
                reviewed: false,
                mastery: 'weak',
                note: '',
              }],
              updatedAt: now(),
            }
          : course),
      })),
      updateLesson: (courseId, lessonId, patch) => update(current => ({
        ...current,
        courses: current.courses.map(course => course.id === courseId
          ? { ...course, lessons: course.lessons.map(lesson => lesson.id === lessonId ? { ...lesson, ...patch } : lesson), updatedAt: now() }
          : course),
      })),
      removeLesson: (courseId, lessonId) => update(current => ({
        ...current,
        courses: current.courses.map(course => course.id === courseId
          ? { ...course, lessons: course.lessons.filter(lesson => lesson.id !== lessonId), updatedAt: now() }
          : course),
      })),
      toggleLessonStep: (courseId, lessonId, step, value) => update(current => ({
        ...current,
        courses: current.courses.map(course => course.id === courseId
          ? {
              ...course,
              lessons: course.lessons.map(lesson => lesson.id === lessonId ? { ...lesson, [step]: value } : lesson),
              updatedAt: now(),
            }
          : course),
      })),

      addTask: input => {
        const id = createId('task')
        update(current => ({
          ...current,
          tasks: [...current.tasks, {
            id,
            ...input,
            title: input.title.trim(),
            createdAt: now(),
            status: 'open',
            completedAt: null,
            order: current.tasks.reduce((max, task) => Math.max(max, task.order), 0) + 1,
          }],
        }))
        return id
      },
      updateTask: (id, patch) => update(current => ({
        ...current,
        tasks: current.tasks.map(task => task.id === id ? { ...task, ...patch } : task),
      })),
      removeTask: id => update(current => ({ ...current, tasks: current.tasks.filter(task => task.id !== id) })),
      toggleTaskDone: (id, done) => update(current => ({
        ...current,
        tasks: current.tasks.map(task => task.id === id
          ? { ...task, status: done ? 'done' : 'open', completedAt: done ? now() : null }
          : task),
      })),
      moveTask: (id, direction) => update(current => ({
        ...current,
        tasks: shiftTaskOrder(current.tasks, id, direction),
      })),

      addNote: input => {
        const id = createId('note')
        update(current => ({
          ...current,
          notes: [...current.notes, {
            id,
            title: input.title.trim(),
            body: input.body,
            category: input.category.trim() || 'عمومی',
            links: input.links,
            createdAt: now(),
            updatedAt: now(),
          }],
        }))
        return id
      },
      updateNote: (id, patch) => update(current => ({
        ...current,
        notes: current.notes.map(note => note.id === id ? { ...note, ...patch, updatedAt: now() } : note),
      })),
      removeNote: id => update(current => ({ ...current, notes: current.notes.filter(note => note.id !== id) })),

      updateLessonWeights: weights => update(current => ({ ...current, settings: { ...current.settings, lessonWeights: weights } })),

      applyImport: (incoming, includeSettings) => {
        const result = mergeImportedState(stateRef.current, incoming, { includeSettings })
        stateRef.current = result.state
        setState(result.state)
        return result.summary
      },
    }
  }, [update])

  /* ------------------------------ cloud sync ------------------------------ */

  const saveOnce = useCallback(async (client: NonNullable<typeof supabase>, ownerId: string): Promise<void> => {
    const snapshot = stateRef.current
    const baseline = baselineRef.current ?? createInitialState(device)
    if (JSON.stringify(snapshot) === JSON.stringify(baseline)) return
    setSync(current => ({ ...current, status: 'saving', pending: true }))
    const saved = await saveCloudState(client, ownerId, snapshot, baseline)
    baselineRef.current = saved.state
    writeSyncedState(ownerId, saved.state)
    if (!aliveRef.current) return
    setSync(current => ({
      ...current,
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: saved.updatedAt,
      error: '',
      pending: false,
      conflicts: saved.conflicts.map(conflict => `${conflict.kind}: ${conflict.label}`),
    }))
    if (saved.conflicts.length) {
      notify(
        'تغییر هم‌زمان در چند دستگاه شناسایی شد؛ تغییر این دستگاه ذخیره شد و نسخهٔ قبلی در گزارش تعارض نگه داشته شد.',
        'warning',
        saved.conflicts.slice(0, 5).map(conflict => `${conflict.kind}: ${conflict.label}`),
      )
    }
    if (stateRef.current === snapshot && JSON.stringify(saved.state) !== JSON.stringify(snapshot)) {
      stateRef.current = saved.state
      setState(saved.state)
    }
  }, [device, notify])

  const flush = useCallback(async (): Promise<void> => {
    const client = supabase
    const ownerId = userId
    if (!client || !ownerId || hydratedFor !== ownerId) return
    if (savingRef.current) { queuedRef.current = true; return }
    savingRef.current = true
    try {
      do {
        queuedRef.current = false
        await saveOnce(client, ownerId)
      } while (queuedRef.current)
    } catch (error) {
      if (!aliveRef.current) return
      const message = error instanceof Error ? error.message : 'همگام‌سازی ناموفق بود.'
      setSync(current => ({
        ...current,
        status: navigator.onLine ? 'error' : 'offline',
        error: message,
        pending: true,
      }))
      notify(message, 'error')
    } finally {
      savingRef.current = false
    }
  }, [hydratedFor, notify, saveOnce, userId])

  useEffect(() => {
    setSync(current => ({ ...current, retry: () => { void flush() } }))
  }, [flush])

  useEffect(() => {
    const client = supabase
    if (!client || !userId) {
      baselineRef.current = null
      setHydratedFor(null)
      setSync(current => ({ ...current, status: 'local', pending: false, error: '' }))
      return
    }
    let alive = true
    setHydratedFor(null)
    baselineRef.current = null
    setSync(current => ({ ...current, status: 'loading', error: '', conflicts: [] }))

    const hydrate = async () => {
      try {
        const remote = await loadCloudState(client, userId, device)
        if (!alive) return
        const local = stateRef.current
        const cached = readSyncedState(userId, device)
        let lastUser: string | null = null
        try { lastUser = localStorage.getItem(LAST_USER_KEY) } catch { lastUser = null }
        let next: AppState
        let baseline: AppState
        if (remote.state) {
          baseline = remote.state
          next = cached && JSON.stringify(serializeState(cached)) !== JSON.stringify(serializeState(remote.state))
            ? mergeAppStates(cached, local, remote.state).state
            : remote.state
        } else {
          baseline = createInitialState(device)
          next = cached ?? (lastUser && lastUser !== userId ? createInitialState(device) : local)
        }
        const saved = await saveCloudState(client, userId, next, baseline)
        if (!alive) return
        baselineRef.current = saved.state
        stateRef.current = saved.state
        setState(saved.state)
        writeLocalState(saved.state)
        writeSyncedState(userId, saved.state)
        try { localStorage.setItem(LAST_USER_KEY, userId) } catch { /* optional */ }
        setHydratedFor(userId)
        setSync(current => ({
          ...current,
          status: navigator.onLine ? 'synced' : 'offline',
          lastSyncedAt: saved.updatedAt,
          error: '',
          pending: false,
          conflicts: saved.conflicts.map(conflict => `${conflict.kind}: ${conflict.label}`),
        }))
      } catch (error) {
        if (!alive) return
        const message = error instanceof Error ? error.message : 'بارگذاری اطلاعات ابری ناموفق بود.'
        setHydratedFor(userId)
        setSync(current => ({ ...current, status: 'error', error: message, pending: false }))
        notify(message, 'error')
      }
    }
    void hydrate()
    return () => { alive = false }
  }, [device, notify, userId])

  useEffect(() => {
    const client = supabase
    if (!client || !userId || hydratedFor !== userId) return
    const channel = client
      .channel(`moroor-v2-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_app_state', filter: `user_id=eq.${userId}` }, payload => {
        const row = payload.new as { payload?: unknown } | null
        const incoming = row?.payload ? fromCloudPayload(row.payload, device) : null
        const base = baselineRef.current
        if (!incoming || !base) return
        const merged = mergeAppStates(base, stateRef.current, incoming)
        baselineRef.current = incoming
        stateRef.current = merged.state
        setState(merged.state)
        writeSyncedState(userId, incoming)
        setSync(current => ({ ...current, status: 'synced', lastSyncedAt: new Date().toISOString(), pending: false }))
        if (merged.conflicts.length) {
          notify('تغییر هم‌زمان از دستگاه دیگر دریافت شد؛ رکورد متعارض با نسخهٔ این دستگاه نمایش داده می‌شود.', 'warning',
            merged.conflicts.slice(0, 5).map(conflict => `${conflict.kind}: ${conflict.label}`))
        }
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [device, hydratedFor, notify, userId])

  useEffect(() => {
    writeLocalState(state)
    const client = supabase
    if (!client || !userId || hydratedFor !== userId) return
    const baseline = baselineRef.current
    if (baseline && JSON.stringify(serializeState(state)) === JSON.stringify(serializeState(baseline))) return
    const timer = window.setTimeout(() => { void flush() }, 700)
    return () => window.clearTimeout(timer)
  }, [state, userId, hydratedFor, flush])

  useEffect(() => {
    const onOnline = () => {
      setSync(current => ({ ...current, status: current.pending ? 'saving' : 'synced', error: '' }))
      void flush()
    }
    const onOffline = () => setSync(current => ({ ...current, status: 'offline' }))
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    if (!navigator.onLine) setSync(current => ({ ...current, status: 'offline' }))
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flush])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!sync.pending) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [sync.pending])

  const value = useMemo<StoreValue>(() => ({
    state,
    today,
    actions,
    sync,
    toasts,
    notify,
    dismissToast,
    userId,
    localMode: !cloudConfigured(),
  }), [state, today, actions, sync, toasts, notify, dismissToast, userId])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside AppStoreProvider')
  return value
}

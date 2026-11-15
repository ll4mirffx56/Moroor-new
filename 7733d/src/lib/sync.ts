import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createInitialState, normalizeState, serializeState, type AppState, type DashboardCardId, type LessonWeights, type Settings,
} from './model.js'
import { DEFAULT_GOALS, type GoalSettings } from './goals.js'
import { DEFAULT_MASTERY_INTERVALS, MASTERY_LEVELS, type Mastery } from './review.js'

export type ConflictInfo = { kind: string; label: string }

export type MergeResult = { state: AppState; conflicts: ConflictInfo[] }

type Identified = { id: string }

const KIND_LABELS = {
  subjects: 'درس',
  chapters: 'فصل',
  topics: 'مبحث',
  reviews: 'مرور',
  studyDays: 'روز مطالعه',
  tests: 'رکورد تست',
  exams: 'آزمون',
  courses: 'دوره',
  tasks: 'کار مطالعاتی',
  notes: 'یادداشت',
} as const

type CollectionKey = keyof typeof KIND_LABELS

const COLLECTION_KEYS = Object.keys(KIND_LABELS) as CollectionKey[]

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Three-way merge for id-keyed collections. A record deleted on one side stays
 * deleted; records created independently on both devices are both kept. If the
 * same record changed on both devices the local edit wins, but the conflict is
 * reported so nothing disappears silently.
 */
function mergeCollection<T extends Identified>(
  base: T[],
  local: T[],
  remote: T[],
  kind: string,
  conflicts: ConflictInfo[],
  label: (item: T) => string,
): T[] {
  const baseMap = new Map(base.map(item => [item.id, item]))
  const localMap = new Map(local.map(item => [item.id, item]))
  const remoteMap = new Map(remote.map(item => [item.id, item]))
  const order = [...new Set([...remote.map(item => item.id), ...local.map(item => item.id), ...base.map(item => item.id)])]
  const result: T[] = []

  for (const id of order) {
    const before = baseMap.get(id)
    const localValue = localMap.get(id)
    const remoteValue = remoteMap.get(id)
    const localChanged = !equal(localValue, before)
    const remoteChanged = !equal(remoteValue, before)

    let chosen: T | undefined
    if (!localChanged) chosen = remoteValue
    else if (!remoteChanged || equal(localValue, remoteValue)) chosen = localValue
    else {
      chosen = localValue
      if (localValue && remoteValue) conflicts.push({ kind, label: label(localValue) })
    }
    if (chosen) result.push(chosen)
  }
  return result
}

function mergeGoals(base: GoalSettings, local: GoalSettings, remote: GoalSettings): GoalSettings {
  return {
    dailyHours: local.dailyHours !== base.dailyHours ? local.dailyHours : remote.dailyHours,
    weeklyHours: local.weeklyHours !== base.weeklyHours ? local.weeklyHours : remote.weeklyHours,
    monthlyHours: local.monthlyHours !== base.monthlyHours ? local.monthlyHours : remote.monthlyHours,
  }
}

function mergeIntervals(base: Record<Mastery, number>, local: Record<Mastery, number>, remote: Record<Mastery, number>): Record<Mastery, number> {
  const result = { ...remote }
  for (const level of MASTERY_LEVELS) {
    if (local[level] !== base[level]) result[level] = local[level]
  }
  return result
}

function mergeWeights(base: LessonWeights, local: LessonWeights, remote: LessonWeights): LessonWeights {
  return {
    video: local.video !== base.video ? local.video : remote.video,
    test: local.test !== base.test ? local.test : remote.test,
    assignment: local.assignment !== base.assignment ? local.assignment : remote.assignment,
    review: local.review !== base.review ? local.review : remote.review,
    mastery: local.mastery !== base.mastery ? local.mastery : remote.mastery,
  }
}

function mergeCards(
  base: Settings['dashboardCards'],
  local: Settings['dashboardCards'],
  remote: Settings['dashboardCards'],
): Settings['dashboardCards'] {
  const baseMap = new Map<DashboardCardId, boolean>(base.map(card => [card.id, card.hidden]))
  const localMap = new Map<DashboardCardId, boolean>(local.map(card => [card.id, card.hidden]))
  const remoteMap = new Map<DashboardCardId, boolean>(remote.map(card => [card.id, card.hidden]))
  const order = [...local.map(card => card.id), ...remote.map(card => card.id).filter(id => !localMap.has(id))]
  return order.map(id => {
    const before = baseMap.get(id)
    const left = localMap.get(id)
    const right = remoteMap.get(id)
    const hidden = left !== undefined && left !== before ? left : (right ?? left ?? false)
    return { id, hidden }
  })
}

function mergeSettings(base: Settings, local: Settings, remote: Settings): Settings {
  return {
    theme: local.theme !== base.theme ? local.theme : remote.theme,
    reduceMotion: local.reduceMotion !== base.reduceMotion ? local.reduceMotion : remote.reduceMotion,
    goals: mergeGoals(base.goals, local.goals, remote.goals),
    masteryIntervals: mergeIntervals(base.masteryIntervals, local.masteryIntervals, remote.masteryIntervals),
    lessonWeights: mergeWeights(base.lessonWeights, local.lessonWeights, remote.lessonWeights),
    dashboardCards: mergeCards(base.dashboardCards, local.dashboardCards, remote.dashboardCards),
    taskSort: local.taskSort !== base.taskSort ? local.taskSort : remote.taskSort,
    legacy: { ...remote.legacy, ...local.legacy },
  }
}

/** Merges a locally edited document with the remote document and the last synced baseline. */
export function mergeAppStates(base: AppState, local: AppState, remote: AppState): MergeResult {
  const conflicts: ConflictInfo[] = []
  const merged: AppState = { ...local, settings: mergeSettings(base.settings, local.settings, remote.settings) }

  merged.subjects = mergeCollection(base.subjects, local.subjects, remote.subjects, 'subjects', conflicts, item => item.name)
  merged.chapters = mergeCollection(base.chapters, local.chapters, remote.chapters, 'chapters', conflicts, item => item.name)
  merged.topics = mergeCollection(base.topics, local.topics, remote.topics, 'topics', conflicts, item => item.name)
  merged.reviews = mergeCollection(base.reviews, local.reviews, remote.reviews, 'reviews', conflicts, item => `${item.subjectName} · ${item.topicName}`)
  merged.studyDays = mergeCollection(base.studyDays, local.studyDays, remote.studyDays, 'studyDays', conflicts, item => item.date)
  merged.tests = mergeCollection(base.tests, local.tests, remote.tests, 'tests', conflicts, item => `${item.subjectName} · ${item.date}`)
  merged.exams = mergeCollection(base.exams, local.exams, remote.exams, 'exams', conflicts, item => item.title)
  merged.courses = mergeCollection(base.courses, local.courses, remote.courses, 'courses', conflicts, item => item.title)
  merged.tasks = mergeCollection(base.tasks, local.tasks, remote.tasks, 'tasks', conflicts, item => item.title)
  merged.notes = mergeCollection(base.notes, local.notes, remote.notes, 'notes', conflicts, item => item.title)
  merged.schemaVersion = local.schemaVersion
  merged.meta = { updatedAt: new Date().toISOString(), deviceId: local.meta.deviceId }

  return { state: merged, conflicts }
}

export function makeEmptyState(deviceId: string): AppState {
  return createInitialState(deviceId)
}

export function fromCloudPayload(payload: unknown, deviceId: string): AppState | null {
  const normalized = normalizeState(payload, deviceId)
  return normalized ? normalized.state : null
}

export function toCloudPayload(state: AppState): Record<string, unknown> {
  return serializeState(state)
}

export type CloudSaveResult = { state: AppState; updatedAt: string; conflicts: ConflictInfo[]; attempts: number }

type CloudRow = { payload: unknown; updated_at: string }

/**
 * Saves with compare-and-swap. Each attempt re-reads the row, merges the newest
 * remote version into the candidate and retries when another device wrote first.
 */
export async function saveCloudState(
  client: SupabaseClient,
  userId: string,
  candidateInput: AppState,
  baselineInput: AppState,
  maxAttempts = 6,
): Promise<CloudSaveResult> {
  let candidate = candidateInput
  let baseline = baselineInput
  let conflicts: ConflictInfo[] = []

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await client
      .from('user_app_state')
      .select('payload, updated_at')
      .eq('user_id', userId)
      .maybeSingle<CloudRow>()
    if (error) throw new Error(`خواندن اطلاعات ابری ناموفق بود: ${error.message}`)

    const remote = data ? fromCloudPayload(data.payload, candidate.meta.deviceId) : null
    if (data && !remote) {
      throw new Error('ساختار اطلاعات ابری معتبر نیست؛ برای جلوگیری از حذف داده‌ها همگام‌سازی متوقف شد.')
    }

    const merged = remote ? mergeAppStates(baseline, candidate, remote) : { state: candidate, conflicts: [] }
    conflicts = merged.conflicts
    if (remote && equal(serializeState(merged.state), serializeState(remote))) {
      return { state: remote, updatedAt: data?.updated_at ?? new Date().toISOString(), conflicts, attempts: attempt + 1 }
    }

    const { data: rpcData, error: rpcError } = await client.rpc('save_user_app_state', {
      p_payload: serializeState(merged.state),
      p_expected_updated_at: data?.updated_at ?? null,
    })
    if (rpcError) {
      throw new Error(`ذخیره‌سازی امن در Supabase انجام نشد (تابع save_user_app_state را اجرا کن): ${rpcError.message}`)
    }
    const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
      | { saved?: boolean; current_payload?: unknown; current_updated_at?: string }
      | null

    if (result?.saved === true) {
      const saved = fromCloudPayload(result.current_payload, candidate.meta.deviceId)
      if (!saved) throw new Error('پاسخ ذخیره‌سازی ابری ساختار معتبر ندارد؛ همگام‌سازی متوقف شد.')
      return {
        state: saved,
        updatedAt: typeof result.current_updated_at === 'string' ? result.current_updated_at : new Date().toISOString(),
        conflicts,
        attempts: attempt + 1,
      }
    }

    const latest = result?.current_payload ? fromCloudPayload(result.current_payload, candidate.meta.deviceId) : null
    baseline = remote ?? latest ?? createInitialState(candidate.meta.deviceId)
    candidate = merged.state
  }

  throw new Error('اطلاعات از دستگاه دیگری هم‌زمان تغییر کرده است؛ پس از چند تلاش ذخیره متوقف شد. دوباره تلاش کن.')
}

export async function loadCloudState(client: SupabaseClient, userId: string, deviceId: string): Promise<{ state: AppState | null; updatedAt: string | null }> {
  const { data, error } = await client
    .from('user_app_state')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle<CloudRow>()
  if (error) throw new Error(`خواندن اطلاعات ابری ناموفق بود: ${error.message}`)
  if (!data) return { state: null, updatedAt: null }
  const state = fromCloudPayload(data.payload, deviceId)
  if (!state) throw new Error('اطلاعات ذخیره‌شده در حساب ساختار معتبر ندارد. برای جلوگیری از بازنویسی، بارگذاری متوقف شد.')
  return { state, updatedAt: data.updated_at }
}

export const SYNC_COLLECTIONS = COLLECTION_KEYS
export const DEFAULT_GOALS_FOR_TESTS = DEFAULT_GOALS
export const DEFAULT_INTERVALS_FOR_TESTS = DEFAULT_MASTERY_INTERVALS

import {
  createInitialState, normalizeState, serializeState, SCHEMA_VERSION, type AppState, type Course, type ExamKind,
  type ExamResult, type Lesson, type Note, type PaletteKey, type Priority, type StudyTask, type TaskKind,
  type TestEntry,
} from './model.js'
import { createId, stableHash } from './id.js'
import { formatJalali, isValidISODate, parseDecimalInput, parseIntegerInput, parseJalaliInput } from './date.js'
import { isValidMastery, MASTERY_LABELS, type Mastery } from './review.js'

export const BACKUP_APP = 'moroor'
export const BACKUP_VERSION = 2

export type ImportPreview = {
  source: 'json' | 'excel'
  state: AppState
  counts: Record<string, number>
  warnings: string[]
  errors: string[]
}

export type CollectionName = 'subjects' | 'chapters' | 'topics' | 'reviews' | 'studyDays' | 'tests' | 'exams' | 'courses' | 'tasks' | 'notes'

export type MergeSummary = Record<CollectionName | 'settings', { added: number; updated: number; unchanged: number }>

const COLLECTIONS: CollectionName[] = ['subjects', 'chapters', 'topics', 'reviews', 'studyDays', 'tests', 'exams', 'courses', 'tasks', 'notes']

export function emptyPreview(source: ImportPreview['source']): ImportPreview {
  return {
    source,
    state: createInitialState('import'),
    counts: {},
    warnings: [],
    errors: [],
  }
}

export function buildBackup(state: AppState) {
  return {
    app: BACKUP_APP,
    backupVersion: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: serializeState(state),
  }
}

export function backupFileName(state: AppState): string {
  const date = state.meta.updatedAt.slice(0, 10)
  return `moroor-backup-${date}.json`
}

export function downloadJsonBackup(state: AppState): void {
  const content = JSON.stringify(buildBackup(state), null, 2)
  downloadBlob(backupFileName(state), new Blob([content], { type: 'application/json;charset=utf-8' }))
}

function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function parseBackupText(text: string): ImportPreview {
  const preview = emptyPreview('json')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    preview.errors.push('فایل JSON معتبر نیست.')
    return preview
  }
  if (!parsed || typeof parsed !== 'object') {
    preview.errors.push('ساختار فایل پشتیبان شناسایی نشد.')
    return preview
  }
  const record = parsed as Record<string, unknown>
  const container = record.app === BACKUP_APP && record.data ? record.data : record
  if (record.app && record.app !== BACKUP_APP) {
    preview.errors.push('این فایل پشتیبان متعلق به Moroor نیست.')
    return preview
  }
  if (typeof record.backupVersion === 'number' && record.backupVersion > BACKUP_VERSION) {
    preview.errors.push('نسخهٔ فایل پشتیبان جدیدتر از این برنامه است.')
    return preview
  }
  const normalized = normalizeState(container, 'import')
  if (!normalized) {
    preview.errors.push('ساختار اطلاعات فایل معتبر نیست؛ برای جلوگیری از خرابی داده، ورود انجام نشد.')
    return preview
  }
  preview.state = normalized.state
  preview.warnings = [...normalized.warnings]
  preview.counts = countCollections(normalized.state)
  return preview
}

export function countCollections(state: AppState): Record<string, number> {
  return {
    subjects: state.subjects.length,
    chapters: state.chapters.length,
    topics: state.topics.length,
    reviews: state.reviews.length,
    studyDays: state.studyDays.length,
    tests: state.tests.length,
    exams: state.exams.length,
    courses: state.courses.length,
    tasks: state.tasks.length,
    notes: state.notes.length,
  }
}

/** Union import: existing records are never removed, imported records win on the same id. */
export function mergeImportedState(
  current: AppState,
  incoming: AppState,
  options: { includeSettings?: boolean } = {},
): { state: AppState; summary: MergeSummary } {
  const summary = {} as MergeSummary
  const result: AppState = structuredCloneSafe(current)

  for (const collection of COLLECTIONS) {
    const existing = new Map((result[collection] as Array<{ id: string }>).map(item => [item.id, item]))
    let added = 0
    let updated = 0
    let unchanged = 0
    const next = [...(result[collection] as Array<{ id: string }>)]
    for (const item of incoming[collection] as Array<{ id: string }>) {
      const before = existing.get(item.id)
      if (!before) {
        next.push(item)
        added += 1
      } else if (JSON.stringify(before) !== JSON.stringify(item)) {
        const index = next.findIndex(candidate => candidate.id === item.id)
        if (index >= 0) next[index] = item
        updated += 1
      } else {
        unchanged += 1
      }
    }
    ;(result[collection] as Array<{ id: string }>) = next
    summary[collection] = { added, updated, unchanged }
  }

  if (options.includeSettings) {
    result.settings = incoming.settings
    summary.settings = { added: 0, updated: 1, unchanged: 0 }
  } else {
    summary.settings = { added: 0, updated: 0, unchanged: 1 }
  }
  result.meta = { ...current.meta, updatedAt: new Date().toISOString() }
  return { state: result, summary }
}

function structuredCloneSafe(state: AppState): AppState {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(state)
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(state)) as AppState
}

/* ------------------------------------------------------------------ */
/* Excel export                                                         */
/* ------------------------------------------------------------------ */

type XLSXModule = typeof import('xlsx')

const SHEETS = {
  studyDays: 'مطالعه',
  tests: 'تست',
  reviews: 'مرور',
  exams: 'آزمون',
  courses: 'دوره‌ها',
  tasks: 'وظایف',
  notes: 'یادداشت‌ها',
} as const

const HEADERS = {
  studyDays: ['شناسه', 'تاریخ', 'ساعت مطالعه', 'ساعت برنامه', 'تمرکز', 'یادداشت'],
  tests: ['شناسه', 'تاریخ', 'درس', 'کل', 'صحیح', 'غلط', 'یادداشت'],
  reviews: ['شناسه', 'درس', 'فصل', 'مبحث', 'تاریخ مطالعه', 'تاریخ مرور', 'وضعیت', 'تسلط', 'مدت (دقیقه)', 'تاریخ انجام', 'یادداشت'],
  exams: ['شناسه', 'عنوان', 'تاریخ', 'نوع', 'درس', 'مبحث', 'کل', 'صحیح', 'غلط', 'یادداشت'],
  courses: ['شناسه', 'دوره', 'درس', 'استاد', 'تاریخ شروع', 'وضعیت', 'شناسه جلسه', 'جلسه', 'مدت جلسه', 'ویدئو', 'تست', 'تکلیف', 'مرور', 'تسلط', 'یادداشت جلسه'],
  tasks: ['شناسه', 'عنوان', 'درس', 'مبحث', 'نوع', 'مهلت', 'اولویت', 'سختی', 'وضعیت', 'یادداشت'],
  notes: ['شناسه', 'عنوان', 'دسته', 'متن'],
} as const

const REVIEW_STATUS_FA: Record<string, string> = { pending: 'در انتظار', completed: 'انجام‌شده', rescheduled: 'جابه‌جاشده' }
const COURSE_STATUS_FA = { active: 'در حال یادگیری', completed: 'تکمیل‌شده', paused: 'متوقف‌شده' } as const
const TASK_KIND_FA = { study: 'مطالعه', test: 'تست', review: 'مرور', assignment: 'تکلیف', other: 'سایر' } as const
const PRIORITY_FA = { high: 'بالا', medium: 'متوسط', low: 'کم' } as const
const EXAM_KIND_FA = { mock: 'آزمایشی', class: 'کلاس', personal: 'شخصی', final: 'جامع' } as const

function reviewStatusKey(value: string): 'pending' | 'completed' | 'rescheduled' {
  const entry = Object.entries(REVIEW_STATUS_FA).find(([, label]) => label === value.trim())
  return (entry?.[0] as 'pending' | 'completed' | 'rescheduled') ?? 'pending'
}

export function buildWorkbook(XLSX: XLSXModule, state: AppState) {
  const workbook = XLSX.utils.book_new()
  const sheet = (name: string, rows: Record<string, unknown>[], headers: readonly string[]) => {
    const sheetObject = XLSX.utils.json_to_sheet(rows, { header: [...headers] })
    XLSX.utils.book_append_sheet(workbook, sheetObject, name)
  }

  sheet(SHEETS.studyDays, state.studyDays
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => ({
      'شناسه': day.id,
      'تاریخ': formatJalali(day.date, 'short'),
      'تاریخ میلادی': day.date,
      'ساعت مطالعه': day.hours,
      'ساعت برنامه': day.plannedHours,
      'تمرکز': day.focus ?? '',
      'یادداشت': day.note,
    })), ['شناسه', 'تاریخ', 'تاریخ میلادی', ...HEADERS.studyDays.slice(2)])

  sheet(SHEETS.tests, state.tests.map(test => ({
    'شناسه': test.id,
    'تاریخ': formatJalali(test.date, 'short'),
    'تاریخ میلادی': test.date,
    'درس': test.subjectName,
    'کل': test.total,
    'صحیح': test.correct,
    'غلط': test.wrong,
    'یادداشت': test.note,
  })), ['شناسه', 'تاریخ', 'تاریخ میلادی', ...HEADERS.tests.slice(2)])

  sheet(SHEETS.reviews, state.reviews.map(review => ({
    'شناسه': review.id,
    'درس': review.subjectName,
    'فصل': review.chapterName,
    'مبحث': review.topicName,
    'تاریخ مطالعه': formatJalali(review.firstStudiedOn, 'short'),
    'تاریخ مطالعه میلادی': review.firstStudiedOn,
    'تاریخ مرور': formatJalali(review.dueDate, 'short'),
    'تاریخ مرور میلادی': review.dueDate,
    'وضعیت': REVIEW_STATUS_FA[review.status] ?? review.status,
    'تسلط': MASTERY_LABELS[review.mastery],
    'مدت (دقیقه)': review.durationMin,
    'تاریخ انجام': review.completedOn ? formatJalali(review.completedOn, 'short') : '',
    'تاریخ انجام میلادی': review.completedOn ?? '',
    'یادداشت': review.notes,
  })), ['شناسه', 'درس', 'فصل', 'مبحث', 'تاریخ مطالعه', 'تاریخ مطالعه میلادی', 'تاریخ مرور', 'تاریخ مرور میلادی', 'وضعیت', 'تسلط', 'مدت (دقیقه)', 'تاریخ انجام', 'تاریخ انجام میلادی', 'یادداشت'])

  const examRows: Record<string, unknown>[] = state.exams.flatMap<Record<string, unknown>>(exam => exam.results.length
    ? exam.results.map(result => ({
        'شناسه': exam.id,
        'عنوان': exam.title,
        'تاریخ': formatJalali(exam.date, 'short'),
        'تاریخ میلادی': exam.date,
        'نوع': EXAM_KIND_FA[exam.kind],
        'درس': result.subjectName,
        'مبحث': result.topicName,
        'کل': result.total,
        'صحیح': result.correct,
        'غلط': result.wrong,
        'یادداشت': exam.note,
      }))
    : [{
        'شناسه': exam.id, 'عنوان': exam.title, 'تاریخ': formatJalali(exam.date, 'short'), 'تاریخ میلادی': exam.date,
        'نوع': EXAM_KIND_FA[exam.kind], 'درس': '', 'مبحث': '', 'کل': '', 'صحیح': '', 'غلط': '', 'یادداشت': exam.note,
      }])
  sheet(SHEETS.exams, examRows, ['شناسه', 'عنوان', 'تاریخ', 'تاریخ میلادی', 'نوع', 'درس', 'مبحث', 'کل', 'صحیح', 'غلط', 'یادداشت'])

  const courseRows: Record<string, unknown>[] = state.courses.flatMap<Record<string, unknown>>(course => course.lessons.length
    ? course.lessons.map(lesson => ({
        'شناسه': course.id,
        'دوره': course.title,
        'درس': course.subjectName,
        'استاد': course.teacher,
        'تاریخ شروع': formatJalali(course.startDate, 'short'),
        'تاریخ شروع میلادی': course.startDate,
        'وضعیت': COURSE_STATUS_FA[course.status],
        'شناسه جلسه': lesson.id,
        'جلسه': lesson.title,
        'مدت جلسه': lesson.durationMin,
        'ویدئو': lesson.watched ? 'بله' : 'خیر',
        'تست': lesson.testDone ? 'بله' : 'خیر',
        'تکلیف': lesson.assignmentDone ? 'بله' : 'خیر',
        'مرور': lesson.reviewed ? 'بله' : 'خیر',
        'تسلط': MASTERY_LABELS[lesson.mastery],
        'یادداشت جلسه': lesson.note,
      }))
    : [{
        'شناسه': course.id, 'دوره': course.title, 'درس': course.subjectName, 'استاد': course.teacher,
        'تاریخ شروع': formatJalali(course.startDate, 'short'), 'تاریخ شروع میلادی': course.startDate,
        'وضعیت': COURSE_STATUS_FA[course.status], 'شناسه جلسه': '', 'جلسه': '', 'مدت جلسه': '',
        'ویدئو': '', 'تست': '', 'تکلیف': '', 'مرور': '', 'تسلط': '', 'یادداشت جلسه': '',
      }])
  sheet(SHEETS.courses, courseRows, ['شناسه', 'دوره', 'درس', 'استاد', 'تاریخ شروع', 'تاریخ شروع میلادی', 'وضعیت', 'شناسه جلسه', 'جلسه', 'مدت جلسه', 'ویدئو', 'تست', 'تکلیف', 'مرور', 'تسلط', 'یادداشت جلسه'])

  sheet(SHEETS.tasks, state.tasks.map(task => ({
    'شناسه': task.id,
    'عنوان': task.title,
    'درس': task.subjectName,
    'مبحث': task.topicName,
    'نوع': TASK_KIND_FA[task.kind],
    'مهلت': formatJalali(task.dueDate, 'short'),
    'مهلت میلادی': task.dueDate,
    'اولویت': PRIORITY_FA[task.priority],
    'سختی': task.difficulty,
    'وضعیت': task.status === 'done' ? 'انجام‌شده' : 'باز',
    'یادداشت': task.note,
  })), ['شناسه', 'عنوان', 'درس', 'مبحث', 'نوع', 'مهلت', 'مهلت میلادی', 'اولویت', 'سختی', 'وضعیت', 'یادداشت'])

  sheet(SHEETS.notes, state.notes.map(note => ({
    'شناسه': note.id,
    'عنوان': note.title,
    'دسته': note.category,
    'متن': note.body,
  })), ['شناسه', 'عنوان', 'دسته', 'متن'])

  return workbook
}

export async function downloadExcelBackup(state: AppState): Promise<void> {
  const XLSX = await import('xlsx')
  const workbook = buildWorkbook(XLSX, state)
  const filename = `moroor-backup-${state.meta.updatedAt.slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, filename)
}

/* ------------------------------------------------------------------ */
/* Excel import                                                         */
/* ------------------------------------------------------------------ */

function readDate(value: unknown): string | null {
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    return null
  }
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  if (isValidISODate(raw)) return raw
  const jalali = parseJalaliInput(raw)
  if (jalali) return jalali
  return null
}

function readExcelDate(value: unknown, XLSX: XLSXModule): string | null {
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const iso = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      return isValidISODate(iso) ? iso : null
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  return readDate(value)
}

function readInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? value : null
  return parseIntegerInput(String(value ?? ''))
}

function readFloat(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  return parseDecimalInput(String(value ?? ''))
}

function readBool(value: unknown): boolean {
  const raw = String(value ?? '').trim()
  return ['بله', 'true', '1', 'yes', 'دارد', 'انجام شد'].includes(raw)
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function header(record: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== '') return record[name]
  }
  return ''
}

function masteryFrom(value: unknown): Mastery {
  const raw = readText(value)
  const entry = Object.entries(MASTERY_LABELS).find(([, label]) => label === raw)
  if (entry) return entry[0] as Mastery
  return isValidMastery(raw) ? raw : 'medium'
}

function priorityFrom(value: unknown): Priority {
  const entry = Object.entries(PRIORITY_FA).find(([, label]) => label === readText(value))
  return (entry?.[0] as Priority) ?? 'medium'
}

function taskKindFrom(value: unknown): TaskKind {
  const entry = Object.entries(TASK_KIND_FA).find(([, label]) => label === readText(value))
  return (entry?.[0] as TaskKind) ?? 'study'
}

function examKindFrom(value: unknown): ExamKind {
  const entry = Object.entries(EXAM_KIND_FA).find(([, label]) => label === readText(value))
  return (entry?.[0] as ExamKind) ?? 'personal'
}

function courseStatusFrom(value: unknown): Course['status'] {
  const entry = Object.entries(COURSE_STATUS_FA).find(([, label]) => label === readText(value))
  return (entry?.[0] as Course['status']) ?? 'active'
}

export async function parseExcelBackup(file: File): Promise<ImportPreview> {
  const XLSX = await import('xlsx')
  const preview = emptyPreview('excel')
  const buffer = await file.arrayBuffer()
  let workbook: ReturnType<XLSXModule['read']>
  try {
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch {
    preview.errors.push('فایل Excel خوانده نشد.')
    return preview
  }
  const state = createInitialState('import')
  state.studyDays = []
  state.tests = []
  state.reviews = []
  state.exams = []
  state.courses = []
  state.tasks = []
  state.notes = []
  state.subjects = []

  const rowsOf = (name: string): Record<string, unknown>[] => {
    const sheetName = workbook.SheetNames.find(candidate => candidate.trim() === name)
    if (!sheetName) return []
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as Record<string, unknown>[]
  }

  const ensureSubject = (name: string): string | null => {
    if (!name) return null
    const existing = state.subjects.find(subject => subject.name === name)
    if (existing) return existing.id
    const id = `import-subject-${stableHash(name)}`
    state.subjects.push({
      id,
      name,
      color: 'blue' as PaletteKey,
      icon: 'book',
      description: '',
      archived: false,
      order: state.subjects.length,
      createdAt: new Date().toISOString(),
    })
    return id
  }

  const addError = (sheet: string, row: number, message: string) => {
    preview.errors.push(`${sheet} · سطر ${row + 2}: ${message}`)
  }

  rowsOf(SHEETS.studyDays).forEach((row, index) => {
    const date = readExcelDate(header(row, 'تاریخ میلادی', 'تاریخ'), XLSX)
    const hours = readFloat(header(row, 'ساعت مطالعه'))
    if (!date) return addError(SHEETS.studyDays, index, 'تاریخ معتبر نیست.')
    if (hours === null || hours > 24) return addError(SHEETS.studyDays, index, 'ساعت مطالعه باید عددی بین ۰ تا ۲۴ باشد.')
    const planned = readFloat(header(row, 'ساعت برنامه')) ?? 0
    if (planned > 24) return addError(SHEETS.studyDays, index, 'ساعت برنامه باید حداکثر ۲۴ باشد.')
    const focusValue = header(row, 'تمرکز')
    const focus = focusValue === '' ? null : readInt(focusValue)
    if (focus !== null && focus > 10) return addError(SHEETS.studyDays, index, 'تمرکز باید بین ۰ تا ۱۰ باشد.')
    const id = readText(header(row, 'شناسه')) || `day-${date}`
    const existingIndex = state.studyDays.findIndex(day => day.id === id || day.date === date)
    const day = {
      id,
      date,
      hours,
      plannedHours: planned,
      focus,
      note: readText(header(row, 'یادداشت')),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (existingIndex >= 0) state.studyDays[existingIndex] = day
    else state.studyDays.push(day)
  })

  rowsOf(SHEETS.tests).forEach((row, index) => {
    const date = readExcelDate(header(row, 'تاریخ میلادی', 'تاریخ'), XLSX)
    const subjectName = readText(header(row, 'درس'))
    const total = readInt(header(row, 'کل'))
    const correct = readInt(header(row, 'صحیح'))
    const wrong = readInt(header(row, 'غلط'))
    if (!date) return addError(SHEETS.tests, index, 'تاریخ معتبر نیست.')
    if (!subjectName) return addError(SHEETS.tests, index, 'نام درس خالی است.')
    if (total === null || correct === null || wrong === null) return addError(SHEETS.tests, index, 'تعدادها باید عدد صحیح نامنفی باشند.')
    if (total === 0) return addError(SHEETS.tests, index, 'تعداد کل باید بیشتر از صفر باشد.')
    if (correct + wrong > total) return addError(SHEETS.tests, index, 'مجموع صحیح و غلط از تعداد کل بیشتر است.')
    const id = readText(header(row, 'شناسه')) || `xls-test-${stableHash(`${date}|${subjectName}|${total}|${correct}|${wrong}`)}`
    const entry: TestEntry = {
      id, date, subjectId: ensureSubject(subjectName), subjectName, total, correct, wrong,
      note: readText(header(row, 'یادداشت')), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const existingIndex = state.tests.findIndex(test => test.id === id)
    if (existingIndex >= 0) state.tests[existingIndex] = entry
    else state.tests.push(entry)
  })

  rowsOf(SHEETS.reviews).forEach((row, index) => {
    const subjectName = readText(header(row, 'درس'))
    const topicName = readText(header(row, 'مبحث'))
    const firstStudiedOn = readExcelDate(header(row, 'تاریخ مطالعه میلادی', 'تاریخ مطالعه'), XLSX)
    const dueDate = readExcelDate(header(row, 'تاریخ مرور میلادی', 'تاریخ مرور'), XLSX)
    if (!subjectName || !topicName) return addError(SHEETS.reviews, index, 'درس و مبحث لازم است.')
    if (!firstStudiedOn || !dueDate) return addError(SHEETS.reviews, index, 'تاریخ مطالعه یا مرور معتبر نیست.')
    const status = reviewStatusKey(readText(header(row, 'وضعیت')))
    const completedOn = readExcelDate(header(row, 'تاریخ انجام میلادی', 'تاریخ انجام'), XLSX)
    const id = readText(header(row, 'شناسه')) || `xls-review-${stableHash(`${subjectName}|${topicName}|${dueDate}`)}`
    const review = {
      id,
      subjectId: ensureSubject(subjectName),
      subjectName,
      chapterId: null,
      chapterName: readText(header(row, 'فصل')),
      topicId: null,
      topicName,
      firstStudiedOn,
      dueDate,
      type: 'scheduled' as const,
      durationMin: readInt(header(row, 'مدت (دقیقه)')) ?? 0,
      mastery: masteryFrom(header(row, 'تسلط')),
      status: status === 'completed' && !completedOn ? 'pending' as const : status,
      completedOn,
      rescheduledTo: null,
      notes: readText(header(row, 'یادداشت')),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const existingIndex = state.reviews.findIndex(item => item.id === id)
    if (existingIndex >= 0) state.reviews[existingIndex] = review
    else state.reviews.push(review)
  })

  const examMap = new Map<string, { id: string; title: string; date: string; kind: ExamKind; note: string; results: ExamResult[] }>()
  rowsOf(SHEETS.exams).forEach((row, index) => {
    const title = readText(header(row, 'عنوان'))
    const date = readExcelDate(header(row, 'تاریخ میلادی', 'تاریخ'), XLSX)
    if (!title || !date) return addError(SHEETS.exams, index, 'عنوان و تاریخ آزمون لازم است.')
    const providedId = readText(header(row, 'شناسه'))
    const key = providedId || `${title}|${date}`
    let exam = examMap.get(key)
    if (!exam) {
      exam = {
        id: providedId || `xls-exam-${stableHash(key)}`,
        title,
        date,
        kind: examKindFrom(header(row, 'نوع')),
        note: readText(header(row, 'یادداشت')),
        results: [],
      }
      examMap.set(key, exam)
    }
    const subjectName = readText(header(row, 'درس'))
    if (!subjectName) return
    const total = readInt(header(row, 'کل'))
    const correct = readInt(header(row, 'صحیح'))
    const wrong = readInt(header(row, 'غلط'))
    if (total === null || correct === null || wrong === null || total <= 0) return addError(SHEETS.exams, index, 'تعدادهای آزمون معتبر نیستند.')
    if (correct + wrong > total) return addError(SHEETS.exams, index, 'مجموع صحیح و غلط از کل بیشتر است.')
    exam.results.push({
      id: `xls-result-${stableHash(`${key}|${subjectName}|${readText(header(row, 'مبحث'))}`)}`,
      subjectId: ensureSubject(subjectName),
      subjectName,
      topicId: null,
      topicName: readText(header(row, 'مبحث')),
      total, correct, wrong,
    })
  })
  state.exams = [...examMap.values()].map(exam => ({ ...exam, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))

  const courseMap = new Map<string, Course>()
  rowsOf(SHEETS.courses).forEach((row, index) => {
    const title = readText(header(row, 'دوره'))
    if (!title) return addError(SHEETS.courses, index, 'نام دوره خالی است.')
    const providedId = readText(header(row, 'شناسه'))
    const key = providedId || title
    let course = courseMap.get(key)
    if (!course) {
      course = {
        id: providedId || `xls-course-${stableHash(key)}`,
        title,
        subjectId: ensureSubject(readText(header(row, 'درس'))),
        subjectName: readText(header(row, 'درس')),
        teacher: readText(header(row, 'استاد')),
        description: '',
        startDate: readExcelDate(header(row, 'تاریخ شروع میلادی', 'تاریخ شروع'), XLSX) ?? new Date().toISOString().slice(0, 10),
        status: courseStatusFrom(header(row, 'وضعیت')),
        lessons: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      courseMap.set(key, course)
    }
    const lessonTitle = readText(header(row, 'جلسه'))
    if (!lessonTitle) return
    const lesson: Lesson = {
      id: readText(header(row, 'شناسه جلسه')) || `xls-lesson-${stableHash(`${key}|${lessonTitle}|${course.lessons.length}`)}`,
      title: lessonTitle,
      order: course.lessons.length,
      durationMin: readInt(header(row, 'مدت جلسه')) ?? 0,
      watched: readBool(header(row, 'ویدئو')),
      testDone: readBool(header(row, 'تست')),
      assignmentDone: readBool(header(row, 'تکلیف')),
      reviewed: readBool(header(row, 'مرور')),
      mastery: masteryFrom(header(row, 'تسلط')),
      note: readText(header(row, 'یادداشت جلسه')),
    }
    course.lessons.push(lesson)
  })
  state.courses = [...courseMap.values()]

  rowsOf(SHEETS.tasks).forEach((row, index) => {
    const title = readText(header(row, 'عنوان'))
    const dueDate = readExcelDate(header(row, 'مهلت میلادی', 'مهلت'), XLSX)
    if (!title || !dueDate) return addError(SHEETS.tasks, index, 'عنوان و مهلت لازم است.')
    const difficulty = readInt(header(row, 'سختی')) ?? 3
    const status = readText(header(row, 'وضعیت')) === 'انجام‌شده' ? 'done' : 'open'
    const task: StudyTask = {
      id: readText(header(row, 'شناسه')) || `xls-task-${stableHash(`${title}|${dueDate}`)}`,
      title,
      subjectId: ensureSubject(readText(header(row, 'درس'))),
      subjectName: readText(header(row, 'درس')),
      topicName: readText(header(row, 'مبحث')),
      kind: taskKindFrom(header(row, 'نوع')),
      createdAt: new Date().toISOString(),
      dueDate,
      priority: priorityFrom(header(row, 'اولویت')),
      difficulty: (difficulty < 1 ? 1 : difficulty > 5 ? 5 : difficulty) as 1 | 2 | 3 | 4 | 5,
      dependsOn: null,
      status,
      completedAt: status === 'done' ? new Date().toISOString() : null,
      order: state.tasks.length,
      note: readText(header(row, 'یادداشت')),
    }
    const existingIndex = state.tasks.findIndex(item => item.id === task.id)
    if (existingIndex >= 0) state.tasks[existingIndex] = task
    else state.tasks.push(task)
  })

  rowsOf(SHEETS.notes).forEach((row, index) => {
    const title = readText(header(row, 'عنوان'))
    if (!title) return addError(SHEETS.notes, index, 'عنوان یادداشت خالی است.')
    const body = readText(header(row, 'متن'))
    const note: Note = {
      id: readText(header(row, 'شناسه')) || `xls-note-${stableHash(`${title}|${body}`)}`,
      title,
      body,
      category: readText(header(row, 'دسته')) || 'عمومی',
      links: { subjectId: null, chapterId: null, topicId: null, courseId: null, examId: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    state.notes.push(note)
  })

  if (!preview.errors.length) {
    const normalized = normalizeState(serializeState(state), 'import')
    if (!normalized) {
      preview.errors.push('اطلاعات خوانده‌شده ساختار معتبر ندارد.')
      return preview
    }
    preview.state = normalized.state
    preview.counts = countCollections(normalized.state)
    preview.warnings = normalized.warnings
  }
  return preview
}

export function previewSummary(preview: ImportPreview): string {
  const entries = Object.entries(preview.counts).filter(([, count]) => count > 0)
  if (!entries.length) return 'داده‌ای برای ورود پیدا نشد.'
  const labels: Record<string, string> = {
    subjects: 'درس', chapters: 'فصل', topics: 'مبحث', reviews: 'مرور', studyDays: 'روز مطالعه',
    tests: 'رکورد تست', exams: 'آزمون', courses: 'دوره', tasks: 'کار', notes: 'یادداشت',
  }
  return entries.map(([key, count]) => `${count} ${labels[key] ?? key}`).join(' · ')
}

export function makeImportPreviewId(): string {
  return createId('import')
}

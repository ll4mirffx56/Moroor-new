import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDaysISO, diffDaysISO, faNumber, faYear, formatJalali, isValidISODate, isoToJalaliParts,
  jalaliMonthMatrix, jalaliMonthRangeISO, jalaliToISO, parseJalaliInput, startOfWeekISO,
  todayISOInTehran, weekdayIndex,
} from '../.test-tmp/lib/date.js'
import {
  aggregateCounts, aggregatePercent, examPercent, unanswered, validateCounts,
} from '../.test-tmp/lib/exam.js'
import {
  countReviews, nextReviewDate, resolveReviewStatus, DEFAULT_MASTERY_INTERVALS,
} from '../.test-tmp/lib/review.js'
import { goalProgress } from '../.test-tmp/lib/goals.js'
import { courseProgress, lessonCompletion } from '../.test-tmp/lib/courses.js'
import { debtSummary, sortTasks } from '../.test-tmp/lib/tasks.js'
import {
  buildActivity, buildAchievements, buildMonthlyReport, buildWeeklyReport, buildWeeklyReview,
  examSeries, subjectStats, topicStats,
} from '../.test-tmp/lib/analytics.js'
import { createInitialState, normalizeState, serializeState } from '../.test-tmp/lib/model.js'
import { buildBackup, mergeImportedState, parseBackupText } from '../.test-tmp/lib/backup.js'
import { mergeAppStates } from '../.test-tmp/lib/sync.js'

const NOW = '2026-11-13T09:00:00.000Z'
const TODAY = '2026-11-13'

function fresh(overrides = {}) {
  const state = createInitialState('test-device', new Date(NOW))
  return { ...state, ...overrides }
}

function note(id, title, body = 'متن') {
  return {
    id, title, body, category: 'عمومی',
    links: { subjectId: null, chapterId: null, topicId: null, courseId: null, examId: null },
    createdAt: NOW, updatedAt: NOW,
  }
}

function studyDay(date, hours) {
  return { id: `day-${date}`, date, hours, plannedHours: hours, focus: 7, note: '', createdAt: NOW, updatedAt: NOW }
}

function testEntry(id, date, subjectName, total, correct, wrong) {
  return { id, date, subjectId: null, subjectName, total, correct, wrong, note: '', createdAt: NOW, updatedAt: NOW }
}

function exam(id, title, date, results) {
  return {
    id, title, date, kind: 'mock', note: '', createdAt: NOW, updatedAt: NOW,
    results: results.map((result, index) => ({
      id: `${id}-r${index}`, subjectId: null, topicId: null, topicName: '', ...result,
    })),
  }
}

/* ------------------------------- exam maths ------------------------------ */

test('unanswered is total minus correct and wrong', () => {
  assert.equal(unanswered({ total: 30, correct: 20, wrong: 5 }), 5)
  assert.equal(unanswered({ total: 30, correct: 20, wrong: 10 }), 0)
})

test('exam percentage follows negative marking and ignores blank answers', () => {
  assert.ok(Math.abs(examPercent({ total: 30, correct: 20, wrong: 5 }) - 61.111111) < 0.001)
  assert.ok(Math.abs(examPercent({ total: 25, correct: 15, wrong: 3 }) - 56) < 0.0001)
  assert.ok(Math.abs(examPercent({ total: 40, correct: 30, wrong: 5 }) - 70.833333) < 0.001)
  assert.equal(examPercent({ total: 0, correct: 0, wrong: 0 }), null)
})

test('invalid counts are rejected instead of silently corrected', () => {
  assert.match(validateCounts({ total: 30, correct: 20, wrong: 15 }), /بیشتر/)
  assert.match(validateCounts({ total: 10, correct: -1, wrong: 0 }), /منفی/)
  assert.match(validateCounts({ total: 1.5, correct: 1, wrong: 0 }), /صحیح/)
  assert.equal(validateCounts({ total: 30, correct: 20, wrong: 5 }), null)
  assert.equal(examPercent({ total: 30, correct: 20, wrong: 15 }), null)
})

test('overall percentage sums answers instead of averaging subject percentages', () => {
  const rows = [
    { total: 30, correct: 20, wrong: 5 },
    { total: 40, correct: 30, wrong: 5 },
  ]
  const overall = aggregatePercent(rows)
  const simpleAverage = (examPercent(rows[0]) + examPercent(rows[1])) / 2
  assert.notEqual(overall, simpleAverage)
  assert.deepEqual(aggregateCounts(rows), { total: 70, correct: 50, wrong: 10 })
  assert.ok(Math.abs(overall - ((50 * 3 - 10) / (70 * 3)) * 100) < 0.0001)
})

/* --------------------------------- dates --------------------------------- */

test('Jalali year 1405 is never rendered with thousands separators', () => {
  assert.equal(faYear(1405), '۱۴۰۵')
  assert.equal(formatJalali('2026-11-06', 'short'), '۱۴۰۵/۰۸/۱۵')
  assert.ok(!formatJalali('2026-11-06', 'long').includes(','))
  assert.ok(!formatJalali('2026-11-06', 'long').includes('٬'))
  assert.equal(isoToJalaliParts('2026-11-06').jy, 1405)
})

test('Jalali conversion round-trips and rejects impossible dates', () => {
  assert.equal(jalaliToISO(1405, 8, 15), '2026-11-06')
  assert.equal(jalaliToISO(1405, 12, 30), null)
  assert.equal(jalaliToISO(1403, 12, 30), '2025-03-20')
  assert.equal(parseJalaliInput('۱۴۰۵/۰۸/۱۵'), '2026-11-06')
  assert.equal(parseJalaliInput('۱۴۰۵/۱۳/۰۱'), null)
  assert.equal(parseJalaliInput('not a date'), null)
})

test('date arithmetic is timezone independent and crosses month boundaries', () => {
  assert.equal(addDaysISO('2026-11-30', 1), '2026-12-01')
  assert.equal(addDaysISO('2026-01-01', -1), '2025-12-31')
  assert.equal(diffDaysISO('2026-11-13', '2026-11-06'), 7)
  assert.equal(isValidISODate('2026-02-30'), false)
  assert.equal(todayISOInTehran(new Date('2026-11-13T21:30:00Z')), '2026-11-14')
  assert.equal(todayISOInTehran(new Date('2026-11-13T20:00:00Z')), '2026-11-13')
})

test('Persian week starts on Saturday and the Jalali month grid is complete', () => {
  assert.equal(weekdayIndex('2026-11-07'), 0)
  assert.equal(startOfWeekISO('2026-11-13'), '2026-11-07')
  assert.equal(startOfWeekISO('2026-11-07'), '2026-11-07')
  const range = jalaliMonthRangeISO('2026-11-13')
  assert.equal(range.start, '2026-10-23')
  assert.equal(range.end, '2026-11-21')
  const cells = jalaliMonthMatrix(1405, 8)
  assert.equal(cells.length % 7, 0)
  assert.equal(cells.filter(cell => cell.inMonth).length, 30)
  assert.ok(cells.every(cell => typeof cell.iso === 'string' && cell.iso.length === 10))
})

test('number formatting uses Persian digits and separators', () => {
  assert.equal(faNumber(1234.5), '۱٬۲۳۴٫۵')
  assert.equal(faNumber(-2.25, 2), '−۲٫۲۵')
  assert.equal(faNumber(0, 0), '۰')
})

/* -------------------------------- reviews -------------------------------- */

test('spaced repetition suggests the configured interval per mastery', () => {
  assert.equal(nextReviewDate('2026-11-13', 'weak', DEFAULT_MASTERY_INTERVALS), '2026-11-14')
  assert.equal(nextReviewDate('2026-11-13', 'medium', DEFAULT_MASTERY_INTERVALS), '2026-11-15')
  assert.equal(nextReviewDate('2026-11-13', 'good', DEFAULT_MASTERY_INTERVALS), '2026-11-17')
  assert.equal(nextReviewDate('2026-11-13', 'excellent', DEFAULT_MASTERY_INTERVALS), '2026-11-20')
})

test('overdue reviews stay actionable, including rescheduled ones', () => {
  assert.equal(resolveReviewStatus({ dueDate: '2026-11-10', status: 'pending' }, TODAY), 'overdue')
  assert.equal(resolveReviewStatus({ dueDate: TODAY, status: 'pending' }, TODAY), 'pending')
  assert.equal(resolveReviewStatus({ dueDate: '2026-11-10', status: 'rescheduled' }, TODAY), 'overdue')
  assert.equal(resolveReviewStatus({ dueDate: TODAY, status: 'completed' }, TODAY), 'completed')
  const counts = countReviews([
    { dueDate: TODAY, status: 'pending' },
    { dueDate: '2026-11-01', status: 'pending' },
    { dueDate: '2026-11-20', status: 'pending' },
    { dueDate: '2026-11-02', status: 'completed' },
  ], TODAY)
  assert.deepEqual(counts, { today: 1, overdue: 1, upcoming: 1, completed: 1 })
})

/* --------------------------------- goals --------------------------------- */

test('goal progress uses the Saturday week and the Jalali month', () => {
  const days = [studyDay('2026-11-07', 4), studyDay('2026-11-13', 3), studyDay('2026-10-23', 2)]
  const progress = goalProgress(days, { dailyHours: 5, weeklyHours: 35, monthlyHours: 150 }, TODAY)
  assert.equal(progress.daily.value, 3)
  assert.equal(progress.weekly.value, 7)
  assert.equal(progress.weekly.percent, 20)
  assert.equal(progress.monthly.value, 9)
  assert.equal(progress.weekly.start, '2026-11-07')
})

/* -------------------------------- courses -------------------------------- */

test('video progress and learning progress are independent', () => {
  const course = {
    id: 'c1', title: 'دوره', subjectId: null, subjectName: 'فیزیک', teacher: '', description: '',
    startDate: '2026-11-01', status: 'active', createdAt: NOW, updatedAt: NOW,
    lessons: [
      { id: 'l1', title: 'یک', order: 0, durationMin: 60, watched: true, testDone: false, assignmentDone: false, reviewed: false, mastery: 'weak', note: '' },
      { id: 'l2', title: 'دو', order: 1, durationMin: 30, watched: false, testDone: false, assignmentDone: false, reviewed: false, mastery: 'weak', note: '' },
      { id: 'l3', title: 'سه', order: 2, durationMin: 45, watched: true, testDone: true, assignmentDone: true, reviewed: true, mastery: 'excellent', note: '' },
    ],
  }
  const progress = courseProgress(course)
  assert.equal(progress.totalSessions, 3)
  assert.equal(progress.watchedSessions, 2)
  assert.ok(Math.abs(progress.videoPercent - 66.6667) < 0.001)
  assert.ok(Math.abs(progress.learningPercent - (20 + 0 + 100) / 3) < 0.001)
  assert.equal(progress.watchedMinutes, 105)
  assert.equal(progress.remainingMinutes, 30)
  assert.equal(lessonCompletion(course.lessons[2]), 100)
})

/* --------------------------------- tasks --------------------------------- */

test('task sorting respects priority, deadline, difficulty and dependencies', () => {
  const base = {
    subjectId: null, subjectName: '', topicName: '', createdAt: NOW, status: 'open', completedAt: null, note: '', order: 0,
  }
  const tasks = [
    { ...base, id: 'a', title: 'کم‌اهمیت', dueDate: '2026-11-12', priority: 'low', difficulty: 1, dependsOn: null, order: 0, kind: 'study' },
    { ...base, id: 'b', title: 'مهم', dueDate: '2026-11-20', priority: 'high', difficulty: 5, dependsOn: null, order: 1, kind: 'study' },
    { ...base, id: 'c', title: 'وابسته', dueDate: '2026-11-14', priority: 'high', difficulty: 3, dependsOn: 'b', order: 2, kind: 'study' },
    { ...base, id: 'd', title: 'انجام‌شده', dueDate: '2026-11-10', priority: 'high', difficulty: 3, dependsOn: null, order: 3, kind: 'study', status: 'done', completedAt: NOW },
  ]
  const sorted = sortTasks(tasks, TODAY, 'auto')
  assert.equal(sorted[0].id, 'a')
  assert.equal(sorted[sorted.length - 1].id, 'd')
  assert.equal(sorted.find(task => task.id === 'c').blockedBy, 'مهم')
  assert.equal(debtSummary(tasks, TODAY).overdue, 1)
  assert.equal(debtSummary(tasks, TODAY).completed, 1)
})

/* ----------------------------- analytics --------------------------------- */

test('activity, weekly report and subject analytics derive from stored records', () => {
  const state = fresh({
    studyDays: [studyDay('2026-11-07', 3), studyDay('2026-11-08', 1)],
    tests: [testEntry('t1', '2026-11-07', 'فیزیک', 30, 20, 5)],
    exams: [
      exam('e1', 'آزمون ۱', '2026-11-10', [
        { subjectName: 'فیزیک', total: 30, correct: 20, wrong: 5 },
        { subjectName: 'شیمی', total: 25, correct: 15, wrong: 3 },
      ]),
      exam('e2', 'آزمون ۲', '2026-11-12', [
        { subjectName: 'فیزیک', total: 20, correct: 6, wrong: 6, topicName: 'حرکت‌شناسی' },
      ]),
    ],
  })
  const activity = buildActivity(state, '2026-11-07', '2026-11-13')
  assert.equal(activity.length, 7)
  assert.equal(activity[0].tests, 30)
  assert.equal(activity[0].percent, 61.111111111111114)

  const report = buildWeeklyReport(state, '2026-11-07', TODAY)
  assert.equal(report.stats.hours, 4)
  assert.equal(report.stats.tests.total, 30)
  assert.equal(report.stats.exams.count, 2)
  assert.equal(report.stats.activeDays, 4)
  assert.equal(report.stats.goalPercent, Math.round((4 / 35) * 1000) / 10)

  const subjects = subjectStats(state, TODAY)
  const physics = subjects.find(item => item.subjectName === 'فیزیک')
  assert.equal(physics.count, 2)
  assert.ok(Math.abs(physics.average - 40.55555555555556) < 0.001)
  assert.equal(physics.best, 61.111111111111114)

  const topics = topicStats(state)
  assert.equal(topics.length, 1)
  assert.equal(topics[0].topicName, 'حرکت‌شناسی')

  const series = examSeries(state, '2026-11-01', TODAY, 'فیزیک')
  assert.equal(series.length, 2)
  assert.equal(series[0].date, '2026-11-10')

  const review = buildWeeklyReview(state, '2026-11-07', TODAY)
  assert.equal(review.sufficientData, true)
  assert.ok(review.strengths.length + review.problems.length > 0)
  assert.ok(review.suggestions.length > 0)
})

test('weekly analysis refuses to conclude when data is insufficient', () => {
  const state = fresh({ studyDays: [studyDay(TODAY, 2)] })
  const review = buildWeeklyReview(state, startOfWeekISO(TODAY), TODAY)
  assert.equal(review.sufficientData, false)
  assert.equal(review.strengths.length, 0)
  assert.equal(review.problems.length, 0)
  assert.ok(review.caveats.length > 0)
})

test('monthly report and achievements use real records', () => {
  const state = fresh({ studyDays: [studyDay(TODAY, 6)], reviews: [{
    id: 'r1', subjectId: null, subjectName: 'فیزیک', chapterId: null, chapterName: '', topicId: null,
    topicName: 'حرکت', firstStudiedOn: '2026-11-01', dueDate: TODAY, type: 'scheduled', durationMin: 30,
    mastery: 'good', status: 'completed', completedOn: TODAY, rescheduledTo: null, notes: '', createdAt: NOW, updatedAt: NOW,
  }] })
  const monthly = buildMonthlyReport(state, TODAY)
  assert.equal(monthly.stats.hours, 6)
  assert.ok(monthly.weeks.length >= 4)
  const achievements = buildAchievements(state, TODAY)
  assert.equal(achievements.find(item => item.id === 'reviews-50').detail.startsWith('۱'), true)
  assert.equal(achievements.find(item => item.id === 'streak-7').percent, Math.round((1 / 7) * 1000) / 10)
})

/* --------------------------- model & migration ---------------------------- */

test('clearing legacy v1 payload keeps every record and settings', () => {
  const legacy = {
    version: 1,
    reviews: [{
      id: 'legacy-r1', subject: 'شیمی', title: 'استوکیومتری', stage: 'مرور ۱ روزه', stageIndex: 0,
      interval: 1, baseDate: '2026-11-01', dueDate: '2026-11-02', done: false, doneAt: null, tone: 'violet',
    }],
    performance: [{
      id: 'legacy-p1', date: '2026-11-02', hours: 2.5, planned: 3, tests: 30, correct: 20, wrong: 5,
      blank: 5, focus: 7, exams: [{ subject: 'شیمی', tests: 30, correct: 20, wrong: 5 }],
    }],
    intervals: [1, 3, 7, 30, 90],
    theme: 'dark',
    panelOrder: ['weekly', 'goal'],
    reduceMotion: false,
    studyGoals: { weeklyHours: 40, monthlyHours: 160 },
  }
  const result = normalizeState(legacy, 'device')
  assert.equal(result.migrated, true)
  assert.equal(result.state.reviews.length, 1)
  assert.equal(result.state.reviews[0].topicName, 'استوکیومتری')
  assert.equal(result.state.reviews[0].status, 'pending')
  assert.equal(result.state.studyDays.length, 1)
  assert.equal(result.state.studyDays[0].hours, 2.5)
  assert.equal(result.state.tests.length, 1)
  assert.equal(result.state.tests[0].total, 30)
  assert.equal(result.state.settings.goals.weeklyHours, 40)
  assert.deepEqual(result.state.settings.legacy.reviewIntervals, [1, 3, 7, 30, 90])
  assert.deepEqual(result.state.settings.legacy.panelOrder, ['weekly', 'goal'])
  // legacy subject names stay readable and no default subject row duplicates محتوا
  assert.ok(result.state.reviews.some(review => review.subjectName === 'شیمی'))
})

test('v2 normalization is stable and rejects corrupt payloads', () => {
  const state = fresh({
    notes: [note('n1', 'یادداشت', 'متن')],
    tests: [testEntry('t1', TODAY, 'فیزیک', 30, 20, 5)],
  })
  const normalized = normalizeState(serializeState(state), 'device')
  assert.ok(normalized)
  assert.equal(normalized.state.notes.length, 1)
  assert.equal(normalized.state.tests[0].total, 30)
  const roundTrip = normalizeState(serializeState(normalized.state), 'device')
  assert.deepEqual(serializeState(roundTrip.state), serializeState(normalized.state))
  assert.equal(normalizeState({ schemaVersion: 2, subjects: 'bad' }), null)
  assert.equal(normalizeState('not-an-object'), null)
})

test('malformed rows are dropped with a warning instead of corrupting the document', () => {
  const payload = {
    schemaVersion: 2,
    subjects: [{ id: 's1', name: 'فیزیک', createdAt: NOW }],
    chapters: [], topics: [],
    reviews: [{ id: 'r1', subjectName: 'فیزیک', topicName: 'حرکت', firstStudiedOn: 'bad', dueDate: TODAY }],
    studyDays: [{ id: 'd1', date: TODAY, hours: 999 }],
    tests: [{ id: 't1', date: TODAY, subjectName: 'فیزیک', total: 10, correct: 9, wrong: 5 }],
    exams: [], courses: [], tasks: [], notes: [],
    settings: {},
    meta: { updatedAt: NOW, deviceId: 'd' },
  }
  const result = normalizeState(payload)
  assert.equal(result.state.reviews.length, 0)
  assert.equal(result.state.tests.length, 0)
  assert.equal(result.state.studyDays[0].hours, 0)
  assert.ok(result.warnings.length > 0)
})

/* -------------------------------- backup --------------------------------- */

test('backup JSON round-trips with schema version and counts', () => {
  const state = fresh({ notes: [note('n1', 'اول'), note('n2', 'دوم')] })
  const backup = buildBackup(state)
  assert.equal(backup.app, 'moroor')
  assert.equal(backup.schemaVersion, 2)
  const preview = parseBackupText(JSON.stringify(backup))
  assert.equal(preview.errors.length, 0)
  assert.equal(preview.counts.notes, 2)
  assert.equal(preview.state.schemaVersion, 2)
  const broken = parseBackupText('{')
  assert.ok(broken.errors.length > 0)
  const wrongApp = parseBackupText(JSON.stringify({ app: 'other', data: {} }))
  assert.ok(wrongApp.errors.length > 0)
})

test('import merges without deleting existing records', () => {
  const current = fresh({ notes: [note('keep', 'قدیمی'), note('both', 'نسخهٔ فعلی')] })
  const incoming = fresh({ notes: [note('both', 'نسخهٔ فایل'), note('new', 'تازه')] })
  const merged = mergeImportedState(current, incoming, { includeSettings: false })
  const ids = merged.state.notes.map(item => item.id).sort()
  assert.deepEqual(ids, ['both', 'keep', 'new'])
  assert.equal(merged.state.notes.find(item => item.id === 'both').title, 'نسخهٔ فایل')
  assert.equal(merged.summary.notes.added, 1)
  assert.equal(merged.summary.notes.updated, 1)
  assert.equal(merged.state.settings.goals.weeklyHours, current.settings.goals.weeklyHours)
})

test('import can optionally restore settings', () => {
  const current = fresh()
  const incoming = fresh({ settings: { ...current.settings, goals: { dailyHours: 8, weeklyHours: 50, monthlyHours: 200 } } })
  const merged = mergeImportedState(current, incoming, { includeSettings: true })
  assert.equal(merged.state.settings.goals.weeklyHours, 50)
})

/* ------------------------------ cloud merge ------------------------------ */

test('three-way merge keeps independent edits from both devices', () => {
  const base = fresh({ notes: [note('n1', 'پایه')] })
  const local = { ...base, notes: [...base.notes, note('n-local', 'محلی')] }
  const remote = { ...base, notes: [...base.notes, note('n-remote', 'دور')] }
  const merged = mergeAppStates(base, local, remote)
  const ids = merged.state.notes.map(item => item.id).sort()
  assert.deepEqual(ids, ['n-local', 'n-remote', 'n1'])
  assert.equal(merged.conflicts.length, 0)
})

test('three-way merge keeps deletions and reports same-record conflicts', () => {
  const base = fresh({ notes: [note('n1', 'پایه'), note('n2', 'دوم')] })
  const local = { ...base, notes: [note('n2', 'محلی')] }
  const remote = { ...base, notes: [note('n2', 'دور')] }
  const merged = mergeAppStates(base, local, remote)
  assert.equal(merged.state.notes.some(item => item.id === 'n1'), false)
  assert.equal(merged.state.notes.find(item => item.id === 'n2').title, 'محلی')
  assert.equal(merged.conflicts.length, 1)
})

test('settings merge per field instead of overwriting the whole object', () => {
  const base = fresh()
  const local = { ...base, settings: { ...base.settings, goals: { ...base.settings.goals, weeklyHours: 45 } } }
  const remote = { ...base, settings: { ...base.settings, goals: { ...base.settings.goals, monthlyHours: 180 } } }
  const merged = mergeAppStates(base, local, remote)
  assert.equal(merged.state.settings.goals.weeklyHours, 45)
  assert.equal(merged.state.settings.goals.monthlyHours, 180)
})

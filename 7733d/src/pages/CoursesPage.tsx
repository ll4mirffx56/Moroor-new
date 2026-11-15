import { useMemo, useState } from 'react'
import { Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/AppStore.js'
import { courseProgress, courseTotals, LESSON_STEPS, lessonCompletion, isStepDone } from '../lib/courses.js'
import { COURSE_STATUS_LABELS, type Course, type CourseStatus } from '../lib/model.js'
import { MASTERY_LABELS, MASTERY_LEVELS, type Mastery } from '../lib/review.js'
import { faNumber, formatJalali, formatMinutes, formatPercent, parseIntegerInput } from '../lib/date.js'
import {
  Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Field, IconButton, Input,
  Modal, PageHeader, ProgressBar, Segmented, Select, StatTile, Textarea, cx,
} from '../components/ui.js'
import { DateField } from '../components/JalaliDatePicker.js'
import { ProgressRing } from '../components/charts.js'

type CourseForm = {
  id?: string
  title: string
  subjectId: string
  teacher: string
  description: string
  startDate: string
  status: CourseStatus
}

export function CoursesPage() {
  const { state, today, actions, notify } = useStore()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(state.courses[0]?.id ?? null)
  const [form, setForm] = useState<CourseForm | null>(null)
  const [lessonForm, setLessonForm] = useState<{ title: string; duration: string } | null>(null)
  const [error, setError] = useState('')
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null)
  const [deleteLesson, setDeleteLesson] = useState<{ courseId: string; lessonId: string; title: string } | null>(null)

  const activeSubjects = state.subjects.filter(subject => !subject.archived)
  const totals = courseTotals(state.courses, state.settings.lessonWeights)
  const progressOf = (course: Course) => courseProgress(course, state.settings.lessonWeights)

  const courses = useMemo(() => {
    const list = [...state.courses].sort((a, b) => a.title.localeCompare(b.title, 'fa'))
    if (filter === 'active') return list.filter(course => course.status === 'active')
    if (filter === 'completed') return list.filter(course => progressOf(course).learningPercent >= 99.999)
    return list
  }, [state.courses, filter])

  const selected = state.courses.find(course => course.id === selectedId) ?? courses[0] ?? null
  const selectedProgress = selected ? progressOf(selected) : null

  function openCourseForm(course?: Course) {
    setError('')
    setForm(course
      ? {
          id: course.id,
          title: course.title,
          subjectId: course.subjectId ?? '',
          teacher: course.teacher,
          description: course.description,
          startDate: course.startDate,
          status: course.status,
        }
      : { title: '', subjectId: '', teacher: '', description: '', startDate: today, status: 'active' })
  }

  function saveCourse() {
    if (!form) return
    const title = form.title.trim()
    if (!title) { setError('عنوان دوره را وارد کن.'); return }
    const subject = state.subjects.find(item => item.id === form.subjectId)
    const payload = {
      title,
      subjectId: subject?.id ?? null,
      subjectName: subject?.name ?? '',
      teacher: form.teacher.trim(),
      description: form.description.trim(),
      startDate: form.startDate,
      status: form.status,
    }
    if (form.id) {
      actions.updateCourse(form.id, payload)
      notify('دوره به‌روزرسانی شد.', 'success')
    } else {
      const id = actions.addCourse(payload)
      setSelectedId(id)
      notify('دورهٔ جدید ساخته شد.', 'success')
    }
    setForm(null)
  }

  function saveLesson() {
    if (!lessonForm || !selected) return
    const title = lessonForm.title.trim()
    if (!title) { setError('عنوان جلسه را وارد کن.'); return }
    const duration = parseIntegerInput(lessonForm.duration) ?? 0
    if (duration > 1440) { setError('مدت جلسه حداکثر ۱۴۴۰ دقیقه است.'); return }
    actions.addLesson(selected.id, { title, durationMin: duration })
    notify('جلسه اضافه شد.', 'success')
    setLessonForm({ title: '', duration: '' })
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="یادگیری"
        title="دوره‌های آموزشی"
        description="مدیریت جلسات، تفکیک پیشرفت ویدئویی از پیشرفت واقعی یادگیری و ارزیابی تسلط"
        actions={<Button icon={<Plus size={16} />} onClick={() => openCourseForm()}>دورهٔ جدید</Button>}
      />

      <div className="stat-grid-4">
        <StatTile label="دوره‌ها" value={faNumber(totals.totalCourses, 0)} hint={`${faNumber(totals.activeCourses, 0)} فعال`} />
        <StatTile label="جلسات" value={faNumber(totals.totalSessions, 0)} hint={`${faNumber(totals.watchedSessions, 0)} دیده‌شده`} />
        <StatTile label="پیشرفت ویدئویی" value={formatPercent(totals.videoPercent)} hint="تعداد جلسات دیده‌شده" />
        <StatTile label="پیشرفت یادگیری" value={formatPercent(totals.learningPercent)} hint="مراحل واقعی تکمیل‌شده" tone="positive" />
      </div>

      <div className="filter-bar">
        <Segmented
          ariaLabel="فیلتر دوره‌ها"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'همه' }, { value: 'active', label: 'در حال یادگیری' }, { value: 'completed', label: 'تکمیل‌شده' }]}
        />
      </div>

      {courses.length ? (
        <div className="course-layout">
          <div className="course-list">
            {courses.map(course => {
              const progress = progressOf(course)
              return (
                <button
                  key={course.id}
                  type="button"
                  className={cx('course-card', selected?.id === course.id && 'course-card-active')}
                  onClick={() => setSelectedId(course.id)}
                >
                  <div className="course-card-head">
                    <strong>{course.title}</strong>
                    <Badge tone={course.status === 'completed' ? 'positive' : course.status === 'paused' ? 'warning' : 'info'}>
                      {COURSE_STATUS_LABELS[course.status]}
                    </Badge>
                  </div>
                  <span className="muted">{course.subjectName || 'بدون درس'}{course.teacher ? ` · ${course.teacher}` : ''}</span>
                  <ProgressBar value={progress.learningPercent} compact tone="violet" />
                  <div className="course-card-meta">
                    <span>{faNumber(progress.watchedSessions, 0)}/{faNumber(progress.totalSessions, 0)} جلسه</span>
                    <span>{formatPercent(progress.learningPercent)} یادگیری</span>
                  </div>
                </button>
              )
            })}
          </div>

          {selected && selectedProgress ? (
            <Card
              className="course-detail"
              title={selected.title}
              subtitle={`${selected.subjectName || 'بدون درس'}${selected.teacher ? ` · ${selected.teacher}` : ''} · شروع ${formatJalali(selected.startDate, 'long')}`}
              action={(
                <div className="row-actions">
                  <IconButton label="ویرایش دوره" onClick={() => openCourseForm(selected)}><Pencil size={16} /></IconButton>
                  <IconButton label="حذف دوره" onClick={() => setDeleteCourse(selected)}><Trash2 size={16} /></IconButton>
                </div>
              )}
            >
              {selected.description ? <p className="course-description">{selected.description}</p> : null}

              <div className="course-progress-block">
                <div className="ring-block">
                  <ProgressRing value={selectedProgress.videoPercent} label={`${faNumber(selectedProgress.videoPercent, 0)}٪`} />
                  <span>ویدئوی دیده‌شده</span>
                </div>
                <div className="ring-block">
                  <ProgressRing value={selectedProgress.learningPercent} tone="var(--c-violet)" label={`${faNumber(selectedProgress.learningPercent, 0)}٪`} />
                  <span>یادگیری واقعی</span>
                </div>
                <div className="ring-meta">
                  <strong>{faNumber(selectedProgress.watchedSessions, 0)} از {faNumber(selectedProgress.totalSessions, 0)} جلسه دیده شده</strong>
                  <span>{formatMinutes(selectedProgress.watchedMinutes)} مشاهده‌شده</span>
                  <span>{formatMinutes(selectedProgress.remainingMinutes)} باقی‌مانده</span>
                  <span>{faNumber(selectedProgress.completedSessions, 0)} جلسه کاملاً تکمیل‌شده</span>
                </div>
              </div>

              <ProgressBar label="پیشرفت یادگیری" value={selectedProgress.learningPercent} tone="violet" />

              <div className="lesson-head">
                <h3 className="subhead">جلسات دوره</h3>
                <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setLessonForm({ title: '', duration: '' })}>افزودن جلسه</Button>
              </div>

              {lessonForm ? (
                <div className="lesson-add">
                  <div className="form-grid form-grid-2">
                    <Field label="عنوان جلسه"><Input value={lessonForm.title} onChange={event => setLessonForm({ ...lessonForm, title: event.target.value })} /></Field>
                    <Field label="مدت (دقیقه)"><Input inputMode="numeric" value={lessonForm.duration} onChange={event => setLessonForm({ ...lessonForm, duration: event.target.value })} /></Field>
                  </div>
                  <div className="row-actions">
                    <Button size="sm" variant="secondary" onClick={() => setLessonForm(null)}>انصراف</Button>
                    <Button size="sm" onClick={saveLesson}>افزودن</Button>
                  </div>
                </div>
              ) : null}

              {selected.lessons.length ? (
                <div className="lesson-list">
                  {[...selected.lessons].sort((a, b) => a.order - b.order).map((lesson, index) => {
                    const completion = lessonCompletion(lesson, state.settings.lessonWeights)
                    return (
                      <div key={lesson.id} className="lesson-row">
                        <div className="lesson-title">
                          <span className="lesson-number">{faNumber(index + 1, 0)}</span>
                          <div>
                            <strong>{lesson.title}</strong>
                            <span className="muted">{formatMinutes(lesson.durationMin)} · {formatPercent(completion)} تکمیل</span>
                          </div>
                        </div>
                        <div className="lesson-steps">
                          {LESSON_STEPS.map(step => (
                            <label key={step.key} className={cx('step-check', isStepDone(lesson, step.key) && 'step-check-done')}>
                              <input
                                type="checkbox"
                                checked={isStepDone(lesson, step.key)}
                                onChange={event => {
                                  if (step.key === 'mastery') {
                                    actions.updateLesson(selected.id, lesson.id, { mastery: event.target.checked ? 'good' : 'weak' })
                                    return
                                  }
                                  const key = step.key === 'video' ? 'watched' : step.key === 'test' ? 'testDone' : step.key === 'assignment' ? 'assignmentDone' : 'reviewed'
                                  actions.toggleLessonStep(selected.id, lesson.id, key, event.target.checked)
                                }}
                              />
                              <span>{step.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="lesson-meta">
                          <Select
                            aria-label="میزان تسلط جلسه"
                            value={lesson.mastery}
                            onChange={event => actions.updateLesson(selected.id, lesson.id, { mastery: event.target.value as Mastery })}
                            options={MASTERY_LEVELS.map(level => ({ value: level, label: MASTERY_LABELS[level] }))}
                          />
                          <IconButton label="حذف جلسه" onClick={() => setDeleteLesson({ courseId: selected.id, lessonId: lesson.id, title: lesson.title })}>
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState icon={<PlayCircle size={24} />} title="جلسه‌ای ثبت نشده" description="جلسات دوره را اضافه کن تا پیشرفت محاسبه شود." />
              )}

              <Callout tone="info" title="وزن مراحل یادگیری">
                پیشرفت یادگیری از پنج مرحله ساخته می‌شود: ویدئو، تست آموزشی، تکلیف، مرور و ارزیابی تسلط. وزن هر مرحله در تنظیمات
                قابل تغییر است. تماشای ویدئو به‌تنهایی پیشرفت یادگیری را کامل نمی‌کند.
              </Callout>
            </Card>
          ) : (
            <Card><EmptyState title="دوره‌ای انتخاب نشده" description="از فهرست یک دوره انتخاب کن یا دورهٔ جدید بساز." /></Card>
          )}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<PlayCircle size={26} />}
            title="هنوز دوره‌ای ثبت نشده"
            description="دورهٔ ویدئویی خود را اضافه کن، جلسات را ثبت کن و پیشرفت واقعی یادگیری را ببین."
            action={<Button onClick={() => openCourseForm()}>افزودن دوره</Button>}
          />
        </Card>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'ویرایش دوره' : 'دورهٔ جدید'}
        footer={<><Button variant="secondary" onClick={() => setForm(null)}>انصراف</Button><Button onClick={saveCourse}>ذخیره</Button></>}
      >
        {form ? (
          <div className="form-stack">
            <Field label="عنوان دوره" required>
              <Input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} />
            </Field>
            <div className="form-grid form-grid-2">
              <Field label="درس">
                <Select
                  value={form.subjectId}
                  onChange={event => setForm({ ...form, subjectId: event.target.value })}
                  options={[{ value: '', label: 'بدون درس' }, ...activeSubjects.map(subject => ({ value: subject.id, label: subject.name }))]}
                />
              </Field>
              <Field label="استاد">
                <Input value={form.teacher} onChange={event => setForm({ ...form, teacher: event.target.value })} />
              </Field>
              <DateField label="تاریخ شروع" value={form.startDate} today={today} onChange={iso => setForm({ ...form, startDate: iso })} />
              <Field label="وضعیت دوره">
                <Select
                  value={form.status}
                  onChange={event => setForm({ ...form, status: event.target.value as CourseStatus })}
                  options={(Object.keys(COURSE_STATUS_LABELS) as CourseStatus[]).map(status => ({ value: status, label: COURSE_STATUS_LABELS[status] }))}
                />
              </Field>
            </div>
            <Field label="توضیحات">
              <Textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
            </Field>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteCourse)}
        title="حذف دوره"
        message={deleteCourse ? `دورهٔ «${deleteCourse.title}» و همهٔ جلسات آن حذف شوند؟ این کار قابل بازگشت نیست.` : ''}
        onCancel={() => setDeleteCourse(null)}
        onConfirm={() => {
          if (!deleteCourse) return
          actions.removeCourse(deleteCourse.id)
          if (selectedId === deleteCourse.id) setSelectedId(null)
          notify('دوره حذف شد.', 'info')
          setDeleteCourse(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteLesson)}
        title="حذف جلسه"
        message={deleteLesson ? `جلسهٔ «${deleteLesson.title}» حذف شود؟ پیشرفت دوره تغییر می‌کند.` : ''}
        onCancel={() => setDeleteLesson(null)}
        onConfirm={() => {
          if (!deleteLesson) return
          actions.removeLesson(deleteLesson.courseId, deleteLesson.lessonId)
          notify('جلسه حذف شد.', 'info')
          setDeleteLesson(null)
        }}
      />
    </div>
  )
}

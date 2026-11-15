import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, Check, Clock3, ListFilter, Plus, RotateCcw, Search, Trash2,
} from 'lucide-react'
import { useStore } from '../../store/AppStore.js'
import {
  countReviews, isValidMasteryIntervals, MASTERY_HINTS, MASTERY_LABELS, MASTERY_LEVELS,
  nextReviewDate, resolveReviewStatus, type Mastery,
} from '../../lib/review.js'
import { diffDaysISO, faNumber, formatJalali, formatMinutes, parseIntegerInput, relativeDayLabel } from '../../lib/date.js'
import {
  Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Field, IconButton, Input,
  Modal, Segmented, Select, StatTile, cx,
} from '../../components/ui.js'
import { DateField, JalaliCalendar } from '../../components/JalaliDatePicker.js'
import { PALETTE_CSS } from '../../lib/palette.js'
import type { Review } from '../../lib/model.js'

type ReviewForm = {
  subjectId: string
  chapterId: string
  topicName: string
  firstStudiedOn: string
  dueDate: string
  mastery: Mastery
  durationMin: string
  notes: string
}

type CompletionForm = {
  completedOn: string
  mastery: Mastery
  durationMin: string
  notes: string
  scheduleNext: boolean
  nextDueDate: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'در انتظار',
  completed: 'انجام‌شده',
  overdue: 'عقب‌افتاده',
  rescheduled: 'جابه‌جاشده',
}

export function ReviewsSection() {
  const { state, today, actions, notify } = useStore()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [query, setQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all')
  const [dueFilter, setDueFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ReviewForm | null>(null)
  const [formError, setFormError] = useState('')
  const [dueTouched, setDueTouched] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<Review | null>(null)
  const [completion, setCompletion] = useState<CompletionForm | null>(null)
  const [completionError, setCompletionError] = useState('')
  const [rescheduleTarget, setRescheduleTarget] = useState<Review | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState(today)
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)
  const [calendarDate, setCalendarDate] = useState(today)

  const activeSubjects = state.subjects.filter(subject => !subject.archived)
  const subjectColor = (name: string) => PALETTE_CSS[state.subjects.find(subject => subject.name === name)?.color ?? 'blue']
  const counts = countReviews(state.reviews, today)

  const chapters = useMemo(
    () => form ? state.chapters.filter(chapter => chapter.subjectId === form.subjectId).sort((a, b) => a.order - b.order) : [],
    [form, state.chapters],
  )
  const topicSuggestions = useMemo(() => {
    if (!form) return []
    const chapterIds = form.chapterId ? [form.chapterId] : state.chapters.filter(chapter => chapter.subjectId === form.subjectId).map(chapter => chapter.id)
    return state.topics.filter(topic => chapterIds.includes(topic.chapterId)).map(topic => topic.name)
  }, [form, state.chapters, state.topics])

  const subjectReviews = useMemo(
    () => state.reviews.filter(review => subjectFilter === 'all' || review.subjectName === subjectFilter),
    [state.reviews, subjectFilter],
  )

  const events = useMemo(() => {
    const map: Record<string, number> = {}
    for (const review of state.reviews) {
      if (review.status === 'completed') continue
      map[review.dueDate] = (map[review.dueDate] ?? 0) + 1
    }
    return map
  }, [state.reviews])

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('fa')
    return subjectReviews
      .filter(review => {
        if (search) {
          const text = `${review.subjectName} ${review.chapterName} ${review.topicName} ${review.notes}`.toLocaleLowerCase('fa')
          if (!text.includes(search)) return false
        }
        const status = resolveReviewStatus(review, today)
        if (statusFilter === 'pending' && status !== 'pending') return false
        if (statusFilter === 'overdue' && status !== 'overdue') return false
        if (statusFilter === 'completed' && status !== 'completed') return false
        if (dueFilter === 'today' && (status === 'completed' || review.dueDate !== today)) return false
        if (dueFilter === 'overdue' && (status === 'completed' || review.dueDate >= today)) return false
        if (dueFilter === 'week') {
          const distance = diffDaysISO(review.dueDate, today)
          if (status === 'completed' || distance < 0 || distance > 6) return false
        }
        return true
      })
      .sort((a, b) => {
        const aStatus = resolveReviewStatus(a, today)
        const bStatus = resolveReviewStatus(b, today)
        if ((aStatus === 'completed') !== (bStatus === 'completed')) return aStatus === 'completed' ? 1 : -1
        return a.dueDate.localeCompare(b.dueDate) || a.subjectName.localeCompare(b.subjectName, 'fa')
      })
  }, [subjectReviews, query, statusFilter, dueFilter, today])

  const selectedDayReviews = state.reviews
    .filter(review => review.dueDate === calendarDate && review.status !== 'completed')
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'fa'))

  const subjectsWithReviews = [...new Set(state.reviews.map(review => review.subjectName))]

  function openForm() {
    const subject = activeSubjects[0]
    const suggested = nextReviewDate(today, 'medium', state.settings.masteryIntervals)
    setForm({
      subjectId: subject?.id ?? '',
      chapterId: '',
      topicName: '',
      firstStudiedOn: today,
      dueDate: suggested,
      mastery: 'medium',
      durationMin: '0',
      notes: '',
    })
    setDueTouched(false)
    setFormError('')
    setFormOpen(true)
  }

  useEffect(() => {
    if (!form || dueTouched || !formOpen) return
    setForm(current => current
      ? { ...current, dueDate: nextReviewDate(current.firstStudiedOn, current.mastery, state.settings.masteryIntervals) }
      : current)
  }, [form?.firstStudiedOn, form?.mastery, dueTouched, formOpen, state.settings.masteryIntervals])

  function submitReview() {
    if (!form) return
    const subject = state.subjects.find(item => item.id === form.subjectId)
    if (!subject) { setFormError('درس را انتخاب کن.'); return }
    if (!form.topicName.trim()) { setFormError('نام مبحث یا موضوع را وارد کن.'); return }
    if (!isValidMasteryIntervals(state.settings.masteryIntervals)) { setFormError('فاصله‌های مرور در تنظیمات معتبر نیست.'); return }
    if (form.dueDate < form.firstStudiedOn) { setFormError('تاریخ مرور نمی‌تواند قبل از تاریخ مطالعهٔ اولیه باشد.'); return }
    const duration = parseIntegerInput(form.durationMin) ?? 0
    if (duration > 1440) { setFormError('مدت مرور حداکثر ۲۴ ساعت (۱۴۴۰ دقیقه) است.'); return }
    const topic = state.topics.find(item => item.name === form.topicName.trim() && item.chapterId === form.chapterId)
    const chapter = state.chapters.find(item => item.id === form.chapterId)
    actions.createReview({
      subjectId: subject.id,
      subjectName: subject.name,
      chapterId: chapter?.id ?? null,
      chapterName: chapter?.name ?? '',
      topicId: topic?.id ?? null,
      topicName: form.topicName.trim(),
      firstStudiedOn: form.firstStudiedOn,
      dueDate: form.dueDate,
      mastery: form.mastery,
      durationMin: duration,
      notes: form.notes,
    })
    setFormOpen(false)
    notify(`مرور «${form.topicName.trim()}» برای ${formatJalali(form.dueDate, 'long')} ثبت شد.`, 'success')
  }

  function openComplete(review: Review) {
    const baseDate = today
    setCompleteTarget(review)
    setCompletion({
      completedOn: baseDate,
      mastery: review.mastery,
      durationMin: String(review.durationMin || 0),
      notes: review.notes,
      scheduleNext: true,
      nextDueDate: nextReviewDate(baseDate, review.mastery, state.settings.masteryIntervals),
    })
    setCompletionError('')
  }

  function submitComplete() {
    if (!completeTarget || !completion) return
    const duration = parseIntegerInput(completion.durationMin) ?? 0
    if (duration > 1440) { setCompletionError('مدت مرور حداکثر ۱۴۴۰ دقیقه است.'); return }
    if (!completion.completedOn) { setCompletionError('تاریخ انجام را انتخاب کن.'); return }
    if (completion.scheduleNext && completion.nextDueDate < completion.completedOn) {
      setCompletionError('تاریخ مرور بعدی نمی‌تواند قبل از تاریخ انجام باشد.')
      return
    }
    actions.completeReview(completeTarget.id, {
      completedOn: completion.completedOn,
      mastery: completion.mastery,
      durationMin: duration,
      notes: completion.notes,
      scheduleNext: completion.scheduleNext,
      nextDueDate: completion.scheduleNext ? completion.nextDueDate : undefined,
    })
    notify(
      completion.scheduleNext
        ? `مرور انجام شد و مرور بعدی برای ${formatJalali(completion.nextDueDate, 'long')} ساخته شد.`
        : 'مرور به‌عنوان انجام‌شده ثبت شد.',
      'success',
    )
    setCompleteTarget(null)
    setCompletion(null)
  }

  function submitReschedule() {
    if (!rescheduleTarget) return
    if (!rescheduleDate) return
    actions.rescheduleReview(rescheduleTarget.id, rescheduleDate)
    notify(`تاریخ مرور به ${formatJalali(rescheduleDate, 'long')} تغییر کرد.`, 'success')
    setRescheduleTarget(null)
  }

  return (
    <div className="section-stack">
      <div className="stat-grid-4">
        <StatTile label="مرور امروز" value={faNumber(counts.today, 0)} tone={counts.today ? 'accent' : 'neutral'} hint="سررسید امروز" />
        <StatTile label="عقب‌افتاده" value={faNumber(counts.overdue, 0)} tone={counts.overdue ? 'danger' : 'neutral'} hint="از تاریخ گذشته" />
        <StatTile label="مرور آینده" value={faNumber(counts.upcoming, 0)} hint="برنامه‌ریزی‌شده" />
        <StatTile label="تکمیل‌شده" value={faNumber(counts.completed, 0)} tone="positive" hint="مجموع مرورهای انجام‌شده" />
      </div>

      <Card
        title="مرورهای فاصله‌دار"
        subtitle="بازهٔ پیشنهادی هر مرور از میزان تسلط محاسبه می‌شود و قابل تغییر دستی است."
        action={(
          <div className="row-actions">
            <Segmented
              ariaLabel="نمایش مرورها"
              value={view}
              onChange={setView}
              options={[{ value: 'list', label: 'فهرست' }, { value: 'calendar', label: 'تقویم' }]}
            />
            <Button icon={<Plus size={16} />} onClick={openForm}>افزودن مرور</Button>
          </div>
        )}
      >
        {view === 'calendar' ? (
          <div className="calendar-view">
            <JalaliCalendar value={calendarDate} onChange={setCalendarDate} events={events} today={today} />
            <div className="calendar-day-list">
              <div className="calendar-day-head">
                <strong>{formatJalali(calendarDate, 'full')}</strong>
                <Badge tone={selectedDayReviews.length ? 'info' : 'neutral'}>{faNumber(selectedDayReviews.length, 0)} مرور</Badge>
              </div>
              {selectedDayReviews.length ? selectedDayReviews.map(review => (
                <div key={review.id} className="mini-row">
                  <span className="subject-dot" style={{ background: subjectColor(review.subjectName) }} />
                  <span>{review.subjectName} · {review.topicName}</span>
                  <Badge tone="violet">{MASTERY_LABELS[review.mastery]}</Badge>
                  <IconButton label="انجام شد" onClick={() => openComplete(review)}><Check size={16} /></IconButton>
                  <IconButton label="تغییر تاریخ" onClick={() => { setRescheduleTarget(review); setRescheduleDate(review.dueDate) }}><Clock3 size={16} /></IconButton>
                </div>
              )) : <EmptyState title="مروری برای این روز نیست" description="روزهای دارای مرور با نقطه مشخص شده‌اند." />}
            </div>
          </div>
        ) : (
          <>
            <div className="filter-bar">
              <div className="search-field">
                <Search size={16} aria-hidden="true" />
                <Input
                  aria-label="جست‌وجوی مرورها"
                  placeholder="جست‌وجو در درس، فصل، مبحث…"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                />
              </div>
              <Select
                aria-label="فیلتر درس"
                value={subjectFilter}
                onChange={event => setSubjectFilter(event.target.value)}
                options={[{ value: 'all', label: 'همهٔ درس‌ها' }, ...subjectsWithReviews.map(name => ({ value: name, label: name }))]}
              />
              <Select
                aria-label="فیلتر سررسید"
                value={dueFilter}
                onChange={event => setDueFilter(event.target.value as typeof dueFilter)}
                options={[
                  { value: 'all', label: 'همهٔ موعدها' },
                  { value: 'today', label: 'امروز' },
                  { value: 'week', label: 'هفت روز آینده' },
                  { value: 'overdue', label: 'عقب‌افتاده' },
                ]}
              />
              <div className="filter-status">
                {([['all', 'همه'], ['pending', 'در انتظار'], ['overdue', 'عقب‌افتاده'], ['completed', 'انجام‌شده']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={cx('chip-filter', statusFilter === key && 'chip-filter-active')}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length ? (
              <div className="list">
                {filtered.map(review => {
                  const status = resolveReviewStatus(review, today)
                  return (
                    <article key={review.id} className={cx('review-row', status === 'overdue' && 'review-overdue')}>
                      <div className="review-main">
                        <span className="subject-dot" style={{ background: subjectColor(review.subjectName) }} />
                        <div>
                          <strong>{review.topicName}</strong>
                          <span className="muted">
                            {review.subjectName}
                            {review.chapterName ? ` · ${review.chapterName}` : ''}
                            {review.durationMin > 0 ? ` · ${formatMinutes(review.durationMin)}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="review-meta">
                        <Badge tone={status === 'completed' ? 'positive' : status === 'overdue' ? 'danger' : 'info'}>
                          {STATUS_LABEL[status] ?? status}
                        </Badge>
                        <span title={formatJalali(review.dueDate, 'long')}>{formatJalali(review.dueDate, 'dayMonth')}</span>
                        {status !== 'completed' ? <span className="muted">{relativeDayLabel(review.dueDate, today)}</span> : null}
                        <Badge tone="violet">{MASTERY_LABELS[review.mastery]}</Badge>
                      </div>
                      <div className="row-actions">
                        {status !== 'completed' ? (
                          <>
                            <IconButton label="ثبت انجام مرور" onClick={() => openComplete(review)}><Check size={16} /></IconButton>
                            <IconButton label="تغییر تاریخ مرور" onClick={() => { setRescheduleTarget(review); setRescheduleDate(review.dueDate) }}><Clock3 size={16} /></IconButton>
                          </>
                        ) : (
                          <span className="muted small">{review.completedOn ? formatJalali(review.completedOn, 'dayMonth') : ''}</span>
                        )}
                        <IconButton label="حذف مرور" onClick={() => setDeleteTarget(review)}><Trash2 size={16} /></IconButton>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={<ListFilter size={26} />}
                title="مروری با این فیلترها پیدا نشد"
                description="فیلترها را تغییر بده یا یک مرور جدید ثبت کن."
                action={<Button variant="secondary" onClick={openForm} icon={<Plus size={15} />}>افزودن مرور</Button>}
              />
            )}
          </>
        )}
      </Card>

      <Card title="تحلیل مبحث" subtitle="تصویر کلی هر مبحث بر اساس مرورهای ثبت‌شده">
        <TopicAnalysis />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="افزودن مرور"
        subtitle="تاریخ مرور بعدی از میزان تسلط پیشنهاد می‌شود و قابل تغییر است."
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>انصراف</Button>
            <Button onClick={submitReview} icon={<CalendarDays size={16} />}>ثبت مرور</Button>
          </>
        )}
      >
        {form ? (
          <div className="form-stack">
            <div className="form-grid form-grid-2">
              <Field label="درس" required>
                <Select
                  value={form.subjectId}
                  onChange={event => setForm({ ...form, subjectId: event.target.value, chapterId: '', topicName: '' })}
                  options={[{ value: '', label: 'انتخاب درس', disabled: true }, ...activeSubjects.map(subject => ({ value: subject.id, label: subject.name }))]}
                />
              </Field>
              <Field label="فصل (اختیاری)">
                <Select
                  value={form.chapterId}
                  onChange={event => setForm({ ...form, chapterId: event.target.value, topicName: '' })}
                  options={[{ value: '', label: 'بدون فصل' }, ...chapters.map(chapter => ({ value: chapter.id, label: chapter.name }))]}
                />
              </Field>
              <Field label="مبحث یا موضوع" required hint="می‌توانی نام مبحث جدید را هم تایپ کنی.">
                <>
                  <Input
                    list={`topics-${form.subjectId}`}
                    value={form.topicName}
                    onChange={event => setForm({ ...form, topicName: event.target.value })}
                    placeholder="مثلاً حرکت‌شناسی"
                  />
                  <datalist id={`topics-${form.subjectId}`}>
                    {topicSuggestions.map(name => <option key={name} value={name} />)}
                  </datalist>
                </>
              </Field>
              <Field label="میزان تسلط" hint={MASTERY_HINTS[form.mastery]}>
                <Select
                  value={form.mastery}
                  onChange={event => setForm({ ...form, mastery: event.target.value as Mastery })}
                  options={MASTERY_LEVELS.map(level => ({
                    value: level,
                    label: `${MASTERY_LABELS[level]} · ${faNumber(state.settings.masteryIntervals[level], 0)} روز`,
                  }))}
                />
              </Field>
              <DateField
                label="تاریخ مطالعهٔ اولیه"
                value={form.firstStudiedOn}
                today={today}
                onChange={iso => setForm({ ...form, firstStudiedOn: iso })}
              />
              <DateField
                label="تاریخ مرور"
                value={form.dueDate}
                today={today}
                onChange={iso => { setDueTouched(true); setForm({ ...form, dueDate: iso }) }}
                hint={`پیشنهاد سیستم برای تسلط ${MASTERY_LABELS[form.mastery]}: ${formatJalali(nextReviewDate(form.firstStudiedOn, form.mastery, state.settings.masteryIntervals), 'long')}`}
              />
              <Field label="مدت مرور (دقیقه)">
                <Input inputMode="numeric" value={form.durationMin} onChange={event => setForm({ ...form, durationMin: event.target.value })} placeholder="۰" />
              </Field>
              <Field label="توضیحات">
                <Input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="اختیاری" />
              </Field>
            </div>
            {dueTouched ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw size={14} />}
                onClick={() => { setDueTouched(false); setForm({ ...form, dueDate: nextReviewDate(form.firstStudiedOn, form.mastery, state.settings.masteryIntervals) }) }}
              >
                بازگشت به پیشنهاد سیستم
              </Button>
            ) : null}
            {formError ? <p className="form-error" role="alert">{formError}</p> : null}
            <Callout tone="info">
              فاصلهٔ پیشنهادی بر اساس تسلط: ضعیف {faNumber(state.settings.masteryIntervals.weak, 0)}، متوسط {faNumber(state.settings.masteryIntervals.medium, 0)}،
              خوب {faNumber(state.settings.masteryIntervals.good, 0)} و عالی {faNumber(state.settings.masteryIntervals.excellent, 0)} روز. این مقادیر در تنظیمات قابل تغییرند.
            </Callout>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title="ثبت انجام مرور"
        subtitle={completeTarget ? `${completeTarget.subjectName} · ${completeTarget.topicName}` : ''}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCompleteTarget(null)}>انصراف</Button>
            <Button variant="success" onClick={submitComplete} icon={<Check size={16} />}>ثبت انجام</Button>
          </>
        )}
      >
        {completion ? (
          <div className="form-stack">
            <div className="form-grid form-grid-2">
              <DateField
                label="تاریخ انجام"
                value={completion.completedOn}
                today={today}
                onChange={iso => setCompletion({
                  ...completion,
                  completedOn: iso,
                  nextDueDate: nextReviewDate(iso, completion.mastery, state.settings.masteryIntervals),
                })}
              />
              <Field label="میزان تسلط" hint={MASTERY_HINTS[completion.mastery]}>
                <Select
                  value={completion.mastery}
                  onChange={event => {
                    const mastery = event.target.value as Mastery
                    setCompletion({
                      ...completion,
                      mastery,
                      nextDueDate: nextReviewDate(completion.completedOn, mastery, state.settings.masteryIntervals),
                    })
                  }}
                  options={MASTERY_LEVELS.map(level => ({ value: level, label: MASTERY_LABELS[level] }))}
                />
              </Field>
              <Field label="مدت مرور (دقیقه)">
                <Input inputMode="numeric" value={completion.durationMin} onChange={event => setCompletion({ ...completion, durationMin: event.target.value })} />
              </Field>
              <Field label="توضیحات">
                <Input value={completion.notes} onChange={event => setCompletion({ ...completion, notes: event.target.value })} />
              </Field>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={completion.scheduleNext}
                onChange={event => setCompletion({ ...completion, scheduleNext: event.target.checked })}
              />
              <span>مرور بعدی به‌صورت خودکار ساخته شود</span>
            </label>
            {completion.scheduleNext ? (
              <DateField
                label="تاریخ مرور بعدی"
                value={completion.nextDueDate}
                today={today}
                onChange={iso => setCompletion({ ...completion, nextDueDate: iso })}
                hint={`پیشنهاد تسلط ${MASTERY_LABELS[completion.mastery]}: ${faNumber(state.settings.masteryIntervals[completion.mastery], 0)} روز بعد`}
              />
            ) : null}
            {completionError ? <p className="form-error" role="alert">{completionError}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title="تغییر تاریخ مرور"
        subtitle={rescheduleTarget ? `${rescheduleTarget.subjectName} · ${rescheduleTarget.topicName}` : ''}
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRescheduleTarget(null)}>انصراف</Button>
            <Button onClick={submitReschedule} icon={<Clock3 size={16} />}>ذخیرهٔ تاریخ</Button>
          </>
        )}
      >
        <DateField label="تاریخ جدید" value={rescheduleDate} today={today} onChange={setRescheduleDate} />
        <p className="small-note">مرور جابه‌جاشده در فهرست با وضعیت مشخص نمایش داده می‌شود و در محاسبهٔ مرورهای عقب‌افتاده باقی می‌ماند.</p>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف مرور"
        message={deleteTarget ? `مرور «${deleteTarget.topicName}» از ${formatJalali(deleteTarget.dueDate, 'long')} حذف شود؟ این کار قابل بازگشت نیست.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          actions.removeReview(deleteTarget.id)
          notify('مرور حذف شد.', 'info')
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}

function TopicAnalysis() {
  const { state, today } = useStore()
  const rows = useMemo(() => {
    const map = new Map<string, {
      subjectName: string; topicName: string; total: number; completed: number; last: string | null; next: string | null; mastery: Mastery; overdue: number
    }>()
    for (const review of state.reviews) {
      const key = `${review.subjectName}::${review.topicName}`
      const row = map.get(key) ?? {
        subjectName: review.subjectName, topicName: review.topicName, total: 0, completed: 0,
        last: null, next: null, mastery: review.mastery, overdue: 0,
      }
      row.total += 1
      if (review.status === 'completed') {
        row.completed += 1
        if (review.completedOn && (!row.last || review.completedOn > row.last)) row.last = review.completedOn
      } else {
        if (!row.next || review.dueDate < row.next) row.next = review.dueDate
        if (review.dueDate < today) row.overdue += 1
        row.mastery = review.mastery
      }
      map.set(key, row)
    }
    return [...map.values()].sort((a, b) => b.overdue - a.overdue || (a.next ?? '9999').localeCompare(b.next ?? '9999')).slice(0, 12)
  }, [state.reviews, today])

  if (!rows.length) {
    return <EmptyState title="داده‌ای برای تحلیل مبحث نیست" description="پس از ثبت چند مرور، وضعیت هر مبحث اینجا خلاصه می‌شود." />
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>مبحث</th>
            <th>مرورها</th>
            <th>آخرین مرور</th>
            <th>مرور بعدی</th>
            <th>تسلط</th>
            <th>وضعیت</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={`${row.subjectName}-${row.topicName}`}>
              <td>
                <strong>{row.topicName}</strong>
                <span className="cell-sub">{row.subjectName}</span>
              </td>
              <td>{faNumber(row.completed, 0)} از {faNumber(row.total, 0)}</td>
              <td>{row.last ? formatJalali(row.last, 'long') : '—'}</td>
              <td>{row.next ? formatJalali(row.next, 'long') : '—'}</td>
              <td><Badge tone="violet">{MASTERY_LABELS[row.mastery]}</Badge></td>
              <td>
                {row.overdue > 0
                  ? <Badge tone="danger">{faNumber(row.overdue, 0)} عقب‌افتاده</Badge>
                  : row.next === today
                    ? <Badge tone="info">امروز</Badge>
                    : <Badge tone="neutral">به‌روز</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

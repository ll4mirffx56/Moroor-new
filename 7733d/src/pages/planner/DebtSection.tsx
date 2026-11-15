import { useMemo, useState } from 'react'
import {
  ArrowDown, ArrowUp, Check, ListChecks, Pencil, Plus, Trash2,
} from 'lucide-react'
import { useStore } from '../../store/AppStore.js'
import { debtSummary, debtTrend, filterTasks, sortTasks, type TaskCategory } from '../../lib/tasks.js'
import {
  PRIORITY_LABELS, TASK_KIND_LABELS, type Priority, type StudyTask, type TaskKind,
} from '../../lib/model.js'
import { addDaysISO, endOfWeekISO, faNumber, formatJalali, startOfWeekISO } from '../../lib/date.js'
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal,
  Segmented, Select, StatTile, Textarea, cx,
} from '../../components/ui.js'
import { DateField } from '../../components/JalaliDatePicker.js'
import { MiniBars } from '../../components/charts.js'

type TaskForm = {
  id?: string
  title: string
  subjectId: string
  subjectName: string
  topicName: string
  kind: TaskKind
  dueDate: string
  priority: Priority
  difficulty: number
  dependsOn: string
  note: string
}

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  overdue: 'عقب‌افتاده',
  today: 'امروز',
  upcoming: 'پیش‌رو',
  completed: 'انجام‌شده',
}

export function DebtSection() {
  const { state, today, actions, notify } = useStore()
  const [category, setCategory] = useState<TaskCategory | 'all'>('all')
  const [form, setForm] = useState<TaskForm | null>(null)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<StudyTask | null>(null)

  const summary = debtSummary(state.tasks, today)
  const ordered = useMemo(
    () => sortTasks(state.tasks, today, state.settings.taskSort),
    [state.tasks, today, state.settings.taskSort],
  )
  const visible = filterTasks(ordered, category)
  const activeSubjects = state.subjects.filter(subject => !subject.archived)

  const weeklyTrend = useMemo(() => {
    const starts = Array.from({ length: 8 }, (_, index) => startOfWeekISO(addDaysISO(today, -(7 - index) * 7)))
    return debtTrend(state.tasks, starts, starts.map(start => endOfWeekISO(start)))
  }, [state.tasks, today])

  function openForm(task?: StudyTask) {
    setError('')
    setForm(task
      ? {
          id: task.id,
          title: task.title,
          subjectId: task.subjectId ?? '',
          subjectName: task.subjectName,
          topicName: task.topicName,
          kind: task.kind,
          dueDate: task.dueDate,
          priority: task.priority,
          difficulty: task.difficulty,
          dependsOn: task.dependsOn ?? '',
          note: task.note,
        }
      : {
          title: '',
          subjectId: '',
          subjectName: '',
          topicName: '',
          kind: 'study',
          dueDate: today,
          priority: 'medium',
          difficulty: 3,
          dependsOn: '',
          note: '',
        })
  }

  function submit() {
    if (!form) return
    const title = form.title.trim()
    if (!title) { setError('عنوان کار را وارد کن.'); return }
    if (!form.dueDate) { setError('مهلت انجام را انتخاب کن.'); return }
    if (form.difficulty < 1 || form.difficulty > 5) { setError('سختی باید بین ۱ تا ۵ باشد.'); return }
    if (form.dependsOn && form.dependsOn === form.id) { setError('یک کار نمی‌تواند به خودش وابسته باشد.'); return }
    const payload = {
      title,
      subjectId: form.subjectId || null,
      subjectName: form.subjectName || activeSubjects.find(subject => subject.id === form.subjectId)?.name || '',
      topicName: form.topicName.trim(),
      kind: form.kind,
      dueDate: form.dueDate,
      priority: form.priority,
      difficulty: form.difficulty as 1 | 2 | 3 | 4 | 5,
      dependsOn: form.dependsOn || null,
      note: form.note,
    }
    if (form.id) {
      actions.updateTask(form.id, payload)
      notify('کار مطالعاتی به‌روزرسانی شد.', 'success')
    } else {
      actions.addTask(payload)
      notify('کار جدید به فهرست بدهی اضافه شد.', 'success')
    }
    setForm(null)
  }

  return (
    <div className="section-stack">
      <div className="stat-grid-4">
        <StatTile label="عقب‌افتاده" value={faNumber(summary.overdue, 0)} tone={summary.overdue ? 'danger' : 'neutral'} hint="از مهلت گذشته" />
        <StatTile label="امروز" value={faNumber(summary.today, 0)} hint="مهلت امروز" />
        <StatTile label="نزدیک موعد" value={faNumber(summary.dueSoon, 0)} hint="سه روز آینده" />
        <StatTile label="تکمیل‌شده" value={faNumber(summary.completed, 0)} tone="positive" hint={`${faNumber(summary.open, 0)} کار باز`} />
      </div>

      <Card
        title="بدهی مطالعاتی"
        subtitle="مرتب‌سازی خودکار بر اساس اولویت، مهلت، سختی و وابستگی"
        action={(
          <div className="row-actions">
            <Segmented
              ariaLabel="نوع مرتب‌سازی"
              value={state.settings.taskSort}
              onChange={value => actions.setSettings({ taskSort: value })}
              options={[{ value: 'auto', label: 'خودکار' }, { value: 'manual', label: 'دستی' }]}
            />
            <Button icon={<Plus size={16} />} onClick={() => openForm()}>کار جدید</Button>
          </div>
        )}
      >
        <div className="filter-status">
          {(['all', 'overdue', 'today', 'upcoming', 'completed'] as const).map(key => (
            <button
              key={key}
              type="button"
              className={cx('chip-filter', category === key && 'chip-filter-active')}
              onClick={() => setCategory(key)}
            >
              {key === 'all' ? 'همه' : CATEGORY_LABEL[key]}
            </button>
          ))}
        </div>

        {visible.length ? (
          <div className="list task-list">
            {visible.map(task => (
              <article key={task.id} className={cx('task-row', task.category === 'overdue' && task.status !== 'done' && 'task-overdue')}>
                <button
                  type="button"
                  className={cx('task-check', task.status === 'done' && 'task-check-done')}
                  aria-label={task.status === 'done' ? 'بازگرداندن به حالت انجام‌نشده' : 'علامت‌گذاری به‌عنوان انجام‌شده'}
                  onClick={() => actions.toggleTaskDone(task.id, task.status !== 'done')}
                >
                  {task.status === 'done' ? <Check size={15} /> : null}
                </button>
                <div className="task-main">
                  <strong className={cx(task.status === 'done' && 'task-done-text')}>{task.title}</strong>
                  <span className="muted">
                    {task.subjectName || 'بدون درس'}{task.topicName ? ` · ${task.topicName}` : ''} · {TASK_KIND_LABELS[task.kind]}
                  </span>
                  {task.blockedBy ? <span className="task-blocked">در انتظار: {task.blockedBy}</span> : null}
                </div>
                <div className="task-meta">
                  <Badge tone={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'neutral'}>
                    اولویت {PRIORITY_LABELS[task.priority]}
                  </Badge>
                  <Badge tone={task.category === 'overdue' && task.status !== 'done' ? 'danger' : task.category === 'today' ? 'info' : 'neutral'}>
                    {CATEGORY_LABEL[task.category]}
                  </Badge>
                  <span className="muted">{formatJalali(task.dueDate, 'dayMonth')}</span>
                  <span className="muted">سختی {faNumber(task.difficulty, 0)}</span>
                </div>
                <div className="row-actions">
                  {state.settings.taskSort === 'manual' ? (
                    <>
                      <IconButton label="بالا" onClick={() => actions.moveTask(task.id, 'up')}><ArrowUp size={14} /></IconButton>
                      <IconButton label="پایین" onClick={() => actions.moveTask(task.id, 'down')}><ArrowDown size={14} /></IconButton>
                    </>
                  ) : null}
                  <IconButton label="ویرایش کار" onClick={() => openForm(task)}><Pencil size={14} /></IconButton>
                  <IconButton label="حذف کار" onClick={() => setDeleteTarget(task)}><Trash2 size={14} /></IconButton>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ListChecks size={26} />}
            title="کاری در این دسته نیست"
            description={category === 'all' ? 'کارهای انجام‌نشده و مهلت‌دار را اینجا مدیریت کن.' : 'دستهٔ دیگری را انتخاب کن.'}
            action={<Button variant="secondary" onClick={() => openForm()} icon={<Plus size={15} />}>افزودن کار</Button>}
          />
        )}
      </Card>

      <Card title="روند بدهی" subtitle="تعداد کارهای باز در پایان هر هفته">
        <MiniBars
          height={90}
          items={weeklyTrend.map(point => ({ label: formatJalali(point.weekStart, 'dayMonth'), value: point.open, color: 'var(--c-amber)' }))}
        />
        <div className="trend-labels">
          {weeklyTrend.map(point => <span key={point.weekStart}>{formatJalali(point.weekStart, 'dayMonth')}</span>)}
        </div>
        <p className="small-note">
          این نمودار از تاریخ ایجاد و تکمیل کارهای ثبت‌شده ساخته می‌شود؛ کارهای حذف‌شده در آن بازسازی نمی‌شوند.
        </p>
      </Card>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'ویرایش کار' : 'افزودن کار مطالعاتی'}
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setForm(null)}>انصراف</Button><Button onClick={submit}>{form?.id ? 'ذخیرهٔ تغییرات' : 'افزودن کار'}</Button></>}
      >
        {form ? (
          <div className="form-stack">
            <Field label="عنوان کار" required>
              <Input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="مثلاً تست فصل ۲ فیزیک" />
            </Field>
            <div className="form-grid form-grid-2">
              <Field label="درس">
                <Select
                  value={form.subjectId}
                  onChange={event => {
                    const subject = activeSubjects.find(item => item.id === event.target.value)
                    setForm({ ...form, subjectId: event.target.value, subjectName: subject?.name ?? '' })
                  }}
                  options={[{ value: '', label: 'بدون درس' }, ...activeSubjects.map(subject => ({ value: subject.id, label: subject.name }))]}
                />
              </Field>
              <Field label="مبحث">
                <Input value={form.topicName} onChange={event => setForm({ ...form, topicName: event.target.value })} placeholder="اختیاری" />
              </Field>
              <Field label="نوع کار">
                <Select
                  value={form.kind}
                  onChange={event => setForm({ ...form, kind: event.target.value as TaskKind })}
                  options={(Object.keys(TASK_KIND_LABELS) as TaskKind[]).map(kind => ({ value: kind, label: TASK_KIND_LABELS[kind] }))}
                />
              </Field>
              <DateField label="مهلت انجام" value={form.dueDate} today={today} onChange={iso => setForm({ ...form, dueDate: iso })} required />
              <Field label="اولویت">
                <Select
                  value={form.priority}
                  onChange={event => setForm({ ...form, priority: event.target.value as Priority })}
                  options={(Object.keys(PRIORITY_LABELS) as Priority[]).map(priority => ({ value: priority, label: PRIORITY_LABELS[priority] }))}
                />
              </Field>
              <Field label="سختی" hint="برای مرتب‌سازی خودکار استفاده می‌شود.">
                <Select
                  value={String(form.difficulty)}
                  onChange={event => setForm({ ...form, difficulty: Number(event.target.value) })}
                  options={[1, 2, 3, 4, 5].map(value => ({ value: String(value), label: `${faNumber(value, 0)} از ۵` }))}
                />
              </Field>
              <Field label="وابستگی" hint="تا زمانی که کار مرجع انجام نشود، این کار در انتهای ترتیب قرار می‌گیرد.">
                <Select
                  value={form.dependsOn}
                  onChange={event => setForm({ ...form, dependsOn: event.target.value })}
                  options={[
                    { value: '', label: 'بدون وابستگی' },
                    ...state.tasks
                      .filter(task => task.id !== form.id && task.status !== 'done')
                      .map(task => ({ value: task.id, label: task.title })),
                  ]}
                />
              </Field>
            </div>
            <Field label="یادداشت">
              <Textarea rows={2} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} />
            </Field>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف کار مطالعاتی"
        message={deleteTarget ? `کار «${deleteTarget.title}» حذف شود؟ این کار قابل بازگشت نیست.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          actions.removeTask(deleteTarget.id)
          notify('کار حذف شد.', 'info')
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}

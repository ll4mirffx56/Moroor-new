import { useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, FileJson, FileSpreadsheet, LogOut, Pencil, Plus,
  Search, Trash2, Upload, UserRound,
} from 'lucide-react'
import { useStore } from '../store/AppStore.js'
import {
  backupFileName, countCollections, downloadExcelBackup, downloadJsonBackup, mergeImportedState,
  parseBackupText, parseExcelBackup, previewSummary, type ImportPreview,
} from '../lib/backup.js'
import { DASHBOARD_CARDS, type Note, type NoteLink } from '../lib/model.js'
import { DEFAULT_MASTERY_INTERVALS, MASTERY_LABELS, MASTERY_LEVELS, type Mastery } from '../lib/review.js'
import { DEFAULT_GOALS } from '../lib/goals.js'
import { faNumber, formatJalali, parseDecimalInput, parseIntegerInput } from '../lib/date.js'
import { CLOUD_SETUP_HINT } from '../cloud.js'
import {
  Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal,
  PageHeader, Segmented, Select, StatTile, Switch, Tabs, Textarea, cx,
} from '../components/ui.js'

const TABS = [
  { key: 'list', label: 'یادداشت‌ها' },
  { key: 'settings', label: 'تنظیمات' },
  { key: 'backup', label: 'پشتیبان و تبادل' },
  { key: 'account', label: 'حساب' },
] as const

export type NotesTab = typeof TABS[number]['key']

type NoteForm = {
  id?: string
  title: string
  body: string
  category: string
  links: NoteLink
}

const DEFAULT_CATEGORIES = ['عمومی', 'درس', 'آزمون', 'دوره', 'مرور', 'خطا']

export function NotesSettingsPage({ tab, onTab, email, onSignOut, localMode }: {
  tab: string
  onTab: (tab: NotesTab) => void
  email: string
  onSignOut: () => void
  localMode: boolean
}) {
  const active = (TABS.some(item => item.key === tab) ? tab : 'list') as NotesTab
  return (
    <div className="page">
      <PageHeader
        eyebrow="پروندهٔ یادگیری"
        title="یادداشت‌ها و تنظیمات"
        description="یادداشت‌های متصل به درس و مبحث، تنظیمات مطالعه و مدیریت پشتیبان"
      />
      <Tabs ariaLabel="بخش‌های یادداشت و تنظیمات" value={active} onChange={onTab} tabs={[...TABS]} />
      {active === 'list' ? <NotesSection /> : null}
      {active === 'settings' ? <SettingsSection /> : null}
      {active === 'backup' ? <BackupSection /> : null}
      {active === 'account' ? <AccountSection email={email} onSignOut={onSignOut} localMode={localMode} /> : null}
    </div>
  )
}

function NotesSection() {
  const { state, today, actions, notify } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [form, setForm] = useState<NoteForm | null>(null)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)

  const activeSubjects = state.subjects.filter(subject => !subject.archived)
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...state.notes.map(note => note.category)])]
  const chapters = form?.links.subjectId ? state.chapters.filter(chapter => chapter.subjectId === form.links.subjectId) : []
  const topics = form?.links.chapterId ? state.topics.filter(topic => topic.chapterId === form.links.chapterId) : []

  const notes = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('fa')
    return [...state.notes]
      .filter(note => category === 'all' || note.category === category)
      .filter(note => !search || `${note.title} ${note.body} ${note.category}`.toLocaleLowerCase('fa').includes(search))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.notes, query, category])

  function openForm(note?: Note) {
    setError('')
    setForm(note
      ? { id: note.id, title: note.title, body: note.body, category: note.category, links: { ...note.links } }
      : {
          title: '',
          body: '',
          category: 'عمومی',
          links: { subjectId: null, chapterId: null, topicId: null, courseId: null, examId: null },
        })
  }

  function saveNote() {
    if (!form) return
    const title = form.title.trim()
    if (!title) { setError('عنوان یادداشت را وارد کن.'); return }
    if (form.id) {
      actions.updateNote(form.id, { title, body: form.body, category: form.category.trim() || 'عمومی', links: form.links })
      notify('یادداشت به‌روزرسانی شد.', 'success')
    } else {
      actions.addNote({ title, body: form.body, category: form.category.trim() || 'عمومی', links: form.links })
      notify('یادداشت ذخیره شد.', 'success')
    }
    setForm(null)
  }

  function linkLabels(links: NoteLink): string[] {
    const labels: string[] = []
    const subject = state.subjects.find(item => item.id === links.subjectId)
    const chapter = state.chapters.find(item => item.id === links.chapterId)
    const topic = state.topics.find(item => item.id === links.topicId)
    const course = state.courses.find(item => item.id === links.courseId)
    const exam = state.exams.find(item => item.id === links.examId)
    if (subject) labels.push(subject.name)
    if (chapter) labels.push(chapter.name)
    if (topic) labels.push(topic.name)
    if (course) labels.push(course.title)
    if (exam) labels.push(exam.title)
    return labels
  }

  return (
    <div className="section-stack">
      <Card
        title="دفترچهٔ یادداشت"
        subtitle="یادداشت‌ها به درس، فصل، مبحث، دوره یا آزمون متصل می‌شوند."
        action={<Button icon={<Plus size={16} />} onClick={() => openForm()}>یادداشت جدید</Button>}
      >
        <div className="filter-bar">
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <Input aria-label="جست‌وجوی یادداشت" placeholder="جست‌وجو در عنوان و متن…" value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          <Select
            aria-label="فیلتر دسته"
            value={category}
            onChange={event => setCategory(event.target.value)}
            options={[{ value: 'all', label: 'همهٔ دسته‌ها' }, ...categories.map(item => ({ value: item, label: item }))]}
          />
        </div>

        {notes.length ? (
          <div className="note-grid">
            {notes.map(note => {
              const links = linkLabels(note.links)
              return (
                <article key={note.id} className="note-card">
                  <div className="note-head">
                    <div>
                      <strong>{note.title}</strong>
                      <span className="muted">{formatJalali(note.updatedAt.slice(0, 10), 'long')} · {note.category}</span>
                    </div>
                    <div className="row-actions">
                      <IconButton label="ویرایش یادداشت" onClick={() => openForm(note)}><Pencil size={14} /></IconButton>
                      <IconButton label="حذف یادداشت" onClick={() => setDeleteTarget(note)}><Trash2 size={14} /></IconButton>
                    </div>
                  </div>
                  <p className="note-body">{note.body || 'بدون متن'}</p>
                  {links.length ? (
                    <div className="note-links">
                      {links.map((label, index) => <Badge key={index} tone="violet">{label}</Badge>)}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="یادداشتی پیدا نشد"
            description={state.notes.length ? 'فیلتر یا جست‌وجو را تغییر بده.' : 'اولین یادداشت درسی خود را بنویس.'}
            action={<Button variant="secondary" onClick={() => openForm()}>یادداشت جدید</Button>}
          />
        )}
      </Card>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'ویرایش یادداشت' : 'یادداشت جدید'}
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setForm(null)}>انصراف</Button><Button onClick={saveNote}>ذخیره</Button></>}
      >
        {form ? (
          <div className="form-stack">
            <div className="form-grid form-grid-2">
              <Field label="عنوان" required>
                <Input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} />
              </Field>
              <Field label="دسته">
                <Input list="note-categories" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} />
                <datalist id="note-categories">{categories.map(item => <option key={item} value={item} />)}</datalist>
              </Field>
            </div>
            <Field label="متن یادداشت">
              <Textarea rows={6} value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} />
            </Field>
            <div className="form-grid form-grid-2">
              <Field label="اتصال به درس">
                <Select
                  value={form.links.subjectId ?? ''}
                  onChange={event => setForm({
                    ...form,
                    links: { ...form.links, subjectId: event.target.value || null, chapterId: null, topicId: null },
                  })}
                  options={[{ value: '', label: 'بدون درس' }, ...activeSubjects.map(subject => ({ value: subject.id, label: subject.name }))]}
                />
              </Field>
              <Field label="اتصال به فصل">
                <Select
                  value={form.links.chapterId ?? ''}
                  onChange={event => setForm({ ...form, links: { ...form.links, chapterId: event.target.value || null, topicId: null } })}
                  options={[{ value: '', label: 'بدون فصل' }, ...chapters.map(chapter => ({ value: chapter.id, label: chapter.name }))]}
                  disabled={!chapters.length}
                />
              </Field>
              <Field label="اتصال به مبحث">
                <Select
                  value={form.links.topicId ?? ''}
                  onChange={event => setForm({ ...form, links: { ...form.links, topicId: event.target.value || null } })}
                  options={[{ value: '', label: 'بدون مبحث' }, ...topics.map(topic => ({ value: topic.id, label: topic.name }))]}
                  disabled={!topics.length}
                />
              </Field>
              <Field label="اتصال به دوره">
                <Select
                  value={form.links.courseId ?? ''}
                  onChange={event => setForm({ ...form, links: { ...form.links, courseId: event.target.value || null } })}
                  options={[{ value: '', label: 'بدون دوره' }, ...state.courses.map(course => ({ value: course.id, label: course.title }))]}
                />
              </Field>
              <Field label="اتصال به آزمون">
                <Select
                  value={form.links.examId ?? ''}
                  onChange={event => setForm({ ...form, links: { ...form.links, examId: event.target.value || null } })}
                  options={[{ value: '', label: 'بدون آزمون' }, ...state.exams.map(exam => ({ value: exam.id, label: `${exam.title} · ${formatJalali(exam.date, 'dayMonth')}` }))]}
                />
              </Field>
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <p className="small-note">یادداشت‌ها همراه پشتیبان کامل ذخیره می‌شوند. تاریخ امروز: {formatJalali(today, 'long')}</p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف یادداشت"
        message={deleteTarget ? `یادداشت «${deleteTarget.title}» حذف شود؟ این کار قابل بازگشت نیست.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          actions.removeNote(deleteTarget.id)
          notify('یادداشت حذف شد.', 'info')
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}

function SettingsSection() {
  const { state, actions, notify } = useStore()
  const [goals, setGoals] = useState({
    daily: String(state.settings.goals.dailyHours),
    weekly: String(state.settings.goals.weeklyHours),
    monthly: String(state.settings.goals.monthlyHours),
  })
  const [intervals, setIntervals] = useState<Record<Mastery, string>>({
    weak: String(state.settings.masteryIntervals.weak),
    medium: String(state.settings.masteryIntervals.medium),
    good: String(state.settings.masteryIntervals.good),
    excellent: String(state.settings.masteryIntervals.excellent),
  })
  const [weights, setWeights] = useState({
    video: String(state.settings.lessonWeights.video),
    test: String(state.settings.lessonWeights.test),
    assignment: String(state.settings.lessonWeights.assignment),
    review: String(state.settings.lessonWeights.review),
    mastery: String(state.settings.lessonWeights.mastery),
  })
  const [error, setError] = useState('')

  function saveGoals() {
    setError('')
    const daily = goals.daily.trim() ? parseDecimalInput(goals.daily) : 0
    const weekly = goals.weekly.trim() ? parseDecimalInput(goals.weekly) : 0
    const monthly = goals.monthly.trim() ? parseDecimalInput(goals.monthly) : 0
    if (daily === null || weekly === null || monthly === null) { setError('هدف‌ها باید عدد نامنفی باشند.'); return }
    if (daily > 24 || weekly > 168 || monthly > 744) { setError('هدف روزانه حداکثر ۲۴، هفتگی ۱۶۸ و ماهانه ۷۴۴ ساعت است.'); return }
    actions.setGoals({ dailyHours: daily, weeklyHours: weekly, monthlyHours: monthly })
    notify('هدف‌ها ذخیره شد.', 'success')
  }

  function saveIntervals() {
    setError('')
    const parsed = {} as Record<Mastery, number>
    for (const level of MASTERY_LEVELS) {
      const value = parseIntegerInput(intervals[level])
      if (value === null || value < 1 || value > 180) {
        setError(`فاصلهٔ ${MASTERY_LABELS[level]} باید عدد صحیح بین ۱ تا ۱۸۰ روز باشد.`)
        return
      }
      parsed[level] = value
    }
    actions.setSettings({ masteryIntervals: parsed })
    notify('فاصله‌های مرور ذخیره شد.', 'success')
  }

  function saveWeights() {
    setError('')
    const parsed = {} as typeof state.settings.lessonWeights
    for (const key of ['video', 'test', 'assignment', 'review', 'mastery'] as const) {
      const value = parseDecimalInput(weights[key])
      if (value === null || value < 0 || value > 10) { setError('وزن هر مرحله باید عددی بین ۰ تا ۱۰ باشد.'); return }
      parsed[key] = value
    }
    if (Object.values(parsed).every(value => value === 0)) { setError('حداقل وزن یک مرحله باید بیشتر از صفر باشد.'); return }
    actions.updateLessonWeights(parsed)
    notify('وزن مراحل یادگیری ذخیره شد.', 'success')
  }

  return (
    <div className="settings-stack">
      <Card title="هدف مطالعه" subtitle="مبنای درصد تحقق هدف و گزارش‌ها">
        <div className="form-grid form-grid-3">
          <Field label="هدف روزانه (ساعت)"><Input inputMode="decimal" value={goals.daily} onChange={event => setGoals({ ...goals, daily: event.target.value })} /></Field>
          <Field label="هدف هفتگی (ساعت)"><Input inputMode="decimal" value={goals.weekly} onChange={event => setGoals({ ...goals, weekly: event.target.value })} /></Field>
          <Field label="هدف ماهانه (ساعت)"><Input inputMode="decimal" value={goals.monthly} onChange={event => setGoals({ ...goals, monthly: event.target.value })} /></Field>
        </div>
        <div className="form-actions">
          <Button size="sm" variant="ghost" onClick={() => setGoals({
            daily: String(DEFAULT_GOALS.dailyHours), weekly: String(DEFAULT_GOALS.weeklyHours), monthly: String(DEFAULT_GOALS.monthlyHours),
          })}>بازگردانی پیش‌فرض</Button>
          <Button size="sm" onClick={saveGoals}>ذخیرهٔ هدف‌ها</Button>
        </div>
      </Card>

      <Card title="فاصلهٔ مرور فاصله‌دار" subtitle="تعداد روز تا مرور بعدی، بر اساس میزان تسلط">
        <div className="form-grid form-grid-4">
          {MASTERY_LEVELS.map(level => (
            <Field key={level} label={MASTERY_LABELS[level]} hint="روز">
              <Input inputMode="numeric" value={intervals[level]} onChange={event => setIntervals({ ...intervals, [level]: event.target.value })} />
            </Field>
          ))}
        </div>
        <div className="form-actions">
          <Button size="sm" variant="ghost" onClick={() => setIntervals({
            weak: String(DEFAULT_MASTERY_INTERVALS.weak),
            medium: String(DEFAULT_MASTERY_INTERVALS.medium),
            good: String(DEFAULT_MASTERY_INTERVALS.good),
            excellent: String(DEFAULT_MASTERY_INTERVALS.excellent),
          })}>بازگردانی پیش‌فرض</Button>
          <Button size="sm" onClick={saveIntervals}>ذخیرهٔ فاصله‌ها</Button>
        </div>
      </Card>

      <Card title="وزن مراحل یادگیری دوره" subtitle="پیشرفت واقعی از مجموع وزن مراحل تکمیل‌شده محاسبه می‌شود">
        <div className="form-grid form-grid-5">
          <Field label="ویدئو"><Input inputMode="decimal" value={weights.video} onChange={event => setWeights({ ...weights, video: event.target.value })} /></Field>
          <Field label="تست"><Input inputMode="decimal" value={weights.test} onChange={event => setWeights({ ...weights, test: event.target.value })} /></Field>
          <Field label="تکلیف"><Input inputMode="decimal" value={weights.assignment} onChange={event => setWeights({ ...weights, assignment: event.target.value })} /></Field>
          <Field label="مرور"><Input inputMode="decimal" value={weights.review} onChange={event => setWeights({ ...weights, review: event.target.value })} /></Field>
          <Field label="تسلط"><Input inputMode="decimal" value={weights.mastery} onChange={event => setWeights({ ...weights, mastery: event.target.value })} /></Field>
        </div>
        <div className="form-actions">
          <Button size="sm" variant="ghost" onClick={() => setWeights({ video: '1', test: '1', assignment: '1', review: '1', mastery: '1' })}>بازگردانی پیش‌فرض</Button>
          <Button size="sm" onClick={saveWeights}>ذخیرهٔ وزن‌ها</Button>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </Card>

      <Card title="چیدمان داشبورد" subtitle="کارت‌ها را مرتب کن یا کارت غیرضروری را پنهان کن">
        <div className="card-order-list">
          {state.settings.dashboardCards.map((card, index) => {
            const meta = DASHBOARD_CARDS.find(item => item.id === card.id)
            return (
              <div key={card.id} className={cx('card-order-row', card.hidden && 'card-order-hidden')}>
                <span>{meta?.label ?? card.id}</span>
                <div className="row-actions">
                  <IconButton label="بالا" disabled={index === 0} onClick={() => actions.moveDashboardCard(card.id, 'up')}><ArrowUp size={14} /></IconButton>
                  <IconButton label="پایین" disabled={index === state.settings.dashboardCards.length - 1} onClick={() => actions.moveDashboardCard(card.id, 'down')}><ArrowDown size={14} /></IconButton>
                  <button
                    type="button"
                    className={cx('chip-filter', !card.hidden && 'chip-filter-active')}
                    onClick={() => actions.toggleDashboardCard(card.id)}
                  >
                    {card.hidden ? 'پنهان' : 'نمایان'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="ظاهر و حرکت" subtitle="تنظیمات نمایشی روی همین دستگاه و حساب ذخیره می‌شود">
        <div className="settings-row">
          <Segmented
            ariaLabel="تم"
            value={state.settings.theme}
            onChange={value => actions.setTheme(value)}
            options={[{ value: 'dark', label: 'تیره' }, { value: 'light', label: 'روشن' }]}
          />
          <Segmented
            ariaLabel="مرتب‌سازی کارها"
            value={state.settings.taskSort}
            onChange={value => actions.setSettings({ taskSort: value })}
            options={[{ value: 'auto', label: 'ترتیب خودکار' }, { value: 'manual', label: 'ترتیب دستی' }]}
          />
        </div>
        <Switch
          checked={state.settings.reduceMotion}
          onChange={value => actions.setSettings({ reduceMotion: value })}
          label="کاهش حرکت و انیمیشن"
          hint="اگر انیمیشن‌ها آزاردهنده‌اند فعال کن."
        />
      </Card>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  )
}

function BackupSection() {
  const { state, actions, notify } = useStore()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [includeSettings, setIncludeSettings] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const counts = countCollections(state)

  async function handleFile(file: File) {
    setBusy(true)
    try {
      const result = file.name.toLowerCase().endsWith('.json')
        ? parseBackupText(await file.text())
        : await parseExcelBackup(file)
      setPreview(result)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'خواندن فایل ناموفق بود.', 'error')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function applyImport() {
    if (!preview || preview.errors.length) return
    const summary = actions.applyImport(preview.state, includeSettings)
    const added = Object.values(summary).reduce((total, item) => total + item.added, 0)
    const updated = Object.values(summary).reduce((total, item) => total + item.updated, 0)
    notify(
      `ورود اطلاعات انجام شد: ${faNumber(added, 0)} رکورد جدید و ${faNumber(updated, 0)} رکورد به‌روزشده.`,
      'success',
      preview.warnings.slice(0, 5),
    )
    setPreview(null)
  }

  const mergedExample = preview ? mergeImportedState(state, preview.state, { includeSettings }) : null

  return (
    <div className="section-stack">
      <Card title="وضعیت اطلاعات" subtitle="تعداد رکوردهای ذخیره‌شده در حساب فعلی">
        <div className="stat-grid-4">
          <StatTile label="روز مطالعه" value={faNumber(counts.studyDays, 0)} />
          <StatTile label="رکورد تست" value={faNumber(counts.tests, 0)} />
          <StatTile label="مرور" value={faNumber(counts.reviews, 0)} />
          <StatTile label="آزمون" value={faNumber(counts.exams, 0)} />
          <StatTile label="دوره" value={faNumber(counts.courses, 0)} />
          <StatTile label="کار" value={faNumber(counts.tasks, 0)} />
          <StatTile label="یادداشت" value={faNumber(counts.notes, 0)} />
          <StatTile label="مبحث" value={faNumber(counts.topics, 0)} />
        </div>
      </Card>

      <Card title="خروجی پشتیبان" subtitle="فایل پشتیبان شامل همهٔ اطلاعات لازم برای بازیابی حساب است">
        <div className="backup-actions">
          <Button icon={<FileJson size={16} />} onClick={() => { downloadJsonBackup(state); notify('فایل JSON دانلود شد.', 'success') }}>
            دانلود JSON
          </Button>
          <Button
            variant="secondary"
            icon={<FileSpreadsheet size={16} />}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await downloadExcelBackup(state)
                notify('فایل Excel دانلود شد.', 'success')
              } catch (error) {
                notify(error instanceof Error ? error.message : 'ساخت فایل Excel ناموفق بود.', 'error')
              } finally {
                setBusy(false)
              }
            }}
          >
            دانلود Excel
          </Button>
          <span className="muted">{backupFileName(state)}</span>
        </div>
        <Callout tone="info" title="پشتیبان کامل">
          JSON همهٔ بخش‌ها را با نسخهٔ ساختار ذخیره می‌کند و برای بازیابی کامل مناسب است. Excel برای تبادل و بازبینی
          داده‌هاست؛ هنگام ورود، فقط داده‌های معتبر خوانده می‌شوند.
        </Callout>
      </Card>

      <Card title="ورود اطلاعات" subtitle="پیش از اعمال، پیش‌نمایش و تعداد رکوردهای جدید نمایش داده می‌شود">
        <input
          ref={fileRef}
          type="file"
          accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <div className="backup-actions">
          <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()} disabled={busy}>
            انتخاب فایل JSON یا Excel
          </Button>
          <span className="muted">هیچ رکورد موجودی در ورود اطلاعات حذف نمی‌شود.</span>
        </div>

        {mergedExample && preview ? (
          <div className="import-preview">
            <div className="import-head">
              <strong>پیش‌نمایش ورود</strong>
              <Badge tone={preview.source === 'json' ? 'info' : 'violet'}>{preview.source === 'json' ? 'JSON' : 'Excel'}</Badge>
            </div>
            <p className="muted">{previewSummary(preview)}</p>
            <div className="table-wrap">
              <table className="data-table compact">
                <thead><tr><th>بخش</th><th>در فایل</th><th>جدید</th><th>به‌روزشده</th></tr></thead>
                <tbody>
                  {Object.entries(preview.counts).map(([key, value]) => (
                    <tr key={key}>
                      <td>{collectionLabel(key)}</td>
                      <td>{faNumber(value, 0)}</td>
                      <td>{faNumber(mergedExample.summary[key as keyof typeof mergedExample.summary]?.added ?? 0, 0)}</td>
                      <td>{faNumber(mergedExample.summary[key as keyof typeof mergedExample.summary]?.updated ?? 0, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.warnings.length ? (
              <Callout tone="warning" title="هشدارهای فایل">
                <ul>{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
              </Callout>
            ) : null}
            {preview.errors.length ? (
              <div className="error-list" role="alert">
                <strong>ورود انجام نمی‌شود؛ خطاهای زیر باید اصلاح شوند:</strong>
                <ul>{preview.errors.slice(0, 20).map((error, index) => <li key={index}>{error}</li>)}</ul>
              </div>
            ) : null}
            <Switch
              checked={includeSettings}
              onChange={setIncludeSettings}
              label="تنظیمات فایل پشتیبان هم اعمال شود"
              hint="اگر خاموش باشد، هدف‌ها و تنظیمات فعلی حفظ می‌شوند."
            />
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setPreview(null)}>انصراف</Button>
              <Button onClick={applyImport} disabled={preview.errors.length > 0}>تأیید و ورود اطلاعات</Button>
            </div>
          </div>
        ) : (
          <EmptyState icon={<Upload size={22} />} title="فایلی انتخاب نشده" description="یک پشتیبان JSON یا فایل Excel ساخته‌شده با همین برنامه انتخاب کن." />
        )}
      </Card>
    </div>
  )
}

function collectionLabel(key: string): string {
  const labels: Record<string, string> = {
    subjects: 'درس‌ها', chapters: 'فصل‌ها', topics: 'مباحث', reviews: 'مرورها', studyDays: 'روزهای مطالعه',
    tests: 'تست‌ها', exams: 'آزمون‌ها', courses: 'دوره‌ها', tasks: 'کارها', notes: 'یادداشت‌ها',
  }
  return labels[key] ?? key
}

function AccountSection({ email, onSignOut, localMode }: { email: string; onSignOut: () => void; localMode: boolean }) {
  const { sync, state } = useStore()
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <div className="settings-stack">
      <Card title="حساب کاربری" subtitle="همگام‌سازی بین دستگاه‌ها با همین حساب انجام می‌شود">
        <div className="account-card">
          <span className="avatar avatar-lg" aria-hidden="true">{email ? email.slice(0, 1).toUpperCase() : <UserRound size={20} />}</span>
          <div>
            <strong>{email || 'کاربر محلی'}</strong>
            <span className="muted">{localMode ? 'بدون اتصال ابری' : sync.status === 'synced' ? 'حساب متصل و همگام' : 'حساب متصل'}</span>
          </div>
          {!localMode ? <Button variant="secondary" icon={<LogOut size={16} />} onClick={() => setConfirmOpen(true)}>خروج از حساب</Button> : null}
        </div>
        {localMode ? (
          <Callout tone="warning" title="حالت محلی فعال است">
            <p>{CLOUD_SETUP_HINT}</p>
            <p>در این حالت اطلاعات روی همین مرورگر ذخیره می‌شود و بین دستگاه‌ها همگام نمی‌شود. از بخش پشتیبان، فایل اطلاعات را نگه دار.</p>
          </Callout>
        ) : (
          <Callout tone="positive" title="امنیت داده">
            <p>دسترسی هر کاربر به ردیف اطلاعات خودش با Row Level Security در Supabase محدود می‌شود. کلید سرویس (service_role) هرگز در برنامهٔ سمت کاربر قرار نمی‌گیرد.</p>
            <p>آخرین همگام‌سازی: {sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString('fa-IR') : 'در این نشست هنوز ثبت نشده'}</p>
          </Callout>
        )}
      </Card>

      <Card title="وضعیت ذخیره‌سازی" subtitle="خلاصهٔ فنی برای عیب‌یابی">
        <div className="stat-grid">
          <StatTile label="وضعیت" value={localMode ? 'محلی' : sync.status === 'synced' ? 'همگام' : sync.status === 'saving' ? 'در حال ذخیره' : sync.status === 'offline' ? 'آفلاین' : 'خطا'} />
          <StatTile label="رکوردهای محلی" value={faNumber(countCollections(state).studyDays + countCollections(state).tests + countCollections(state).reviews, 0)} hint="روز + تست + مرور" />
          <StatTile label="تغییر ذخیره‌نشده" value={sync.pending ? 'دارد' : 'ندارد'} tone={sync.pending ? 'warning' : 'positive'} />
        </div>
        {sync.error ? <Callout tone="danger" title="آخرین خطای همگام‌سازی">{sync.error}</Callout> : null}
        <p className="small-note">ذخیره‌سازی محلی پیش از همگام‌سازی انجام می‌شود؛ با قطع اتصال، تغییرات در مرورگر می‌مانند و پس از بازگشت اتصال تلاش دوباره انجام می‌شود.</p>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="خروج از حساب"
        message="از حساب خارج می‌شوی. اطلاعات روی سرور باقی می‌ماند و با ورود دوباره بازیابی می‌شود."
        confirmLabel="خروج"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); onSignOut() }}
      />
    </div>
  )
}

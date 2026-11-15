import { useMemo, useState } from 'react'
import {
  Activity, ArrowUpRight, BookOpenCheck, CalendarClock, Clock3, ListChecks,
  Plus, Target, TrendingDown, TrendingUp, PlayCircle,
} from 'lucide-react'
import { useStore } from '../store/AppStore.js'
import { buildActivity, buildDashboard } from '../lib/analytics.js'
import { addDaysISO, diffDaysISO, faNumber, formatHours, formatJalali, formatPercent } from '../lib/date.js'
import { PALETTE_CSS } from '../lib/palette.js'
import { MASTERY_LABELS } from '../lib/review.js'
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, ProgressBar, Segmented, StatTile, cx,
} from '../components/ui.js'
import { BarChart, LineChart, ProgressRing } from '../components/charts.js'
import type { SectionKey } from '../store/useRoute.js'
import type { DashboardCardId } from '../lib/model.js'

export function DashboardPage({ onNavigate }: { onNavigate: (section: SectionKey, tab?: string) => void }) {
  const { state, today, actions, notify } = useStore()
  const data = useMemo(() => buildDashboard(state, today), [state, today])
  const [range, setRange] = useState<'7' | '14' | '30'>('14')
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [draft, setDraft] = useState({ daily: '', weekly: '', monthly: '' })
  const [goalError, setGoalError] = useState('')

  const activity = useMemo(
    () => buildActivity(state, addDaysISO(today, -(Number(range) - 1)), today),
    [state, today, range],
  )

  const orderedCards = state.settings.dashboardCards.filter(card => !card.hidden)
  const subjectColor = (name: string) => PALETTE_CSS[state.subjects.find(subject => subject.name === name)?.color ?? 'blue']
  const pendingReviews = state.reviews
    .filter(review => review.status !== 'completed')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  function openGoals() {
    setDraft({
      daily: String(state.settings.goals.dailyHours),
      weekly: String(state.settings.goals.weeklyHours),
      monthly: String(state.settings.goals.monthlyHours),
    })
    setGoalError('')
    setGoalsOpen(true)
  }

  function saveGoals() {
    const parse = (value: string) => Number(value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))))
    const daily = parse(draft.daily)
    const weekly = parse(draft.weekly)
    const monthly = parse(draft.monthly)
    if (![daily, weekly, monthly].every(value => Number.isFinite(value) && value >= 0)) {
      setGoalError('هر سه هدف باید عدد نامنفی باشند.')
      return
    }
    if (daily > 24 || weekly > 168 || monthly > 744) {
      setGoalError('هدف روزانه حداکثر ۲۴، هفتگی ۱۶۸ و ماهانه ۷۴۴ ساعت می‌تواند باشد.')
      return
    }
    actions.setGoals({ dailyHours: daily, weeklyHours: weekly, monthlyHours: monthly })
    setGoalsOpen(false)
    notify('هدف‌های مطالعه به‌روزرسانی شد.', 'success')
  }

  const hourPoints = activity.map(day => ({
    label: formatJalali(day.date, 'dayMonth'),
    value: day.hours,
    meta: `${faNumber(day.tests, 0)} تست`,
  }))

  const weekPoints = data.weeklySeries.map(week => ({
    key: week.start,
    label: week.label,
    value: Math.round(week.hours * 10) / 10,
    hint: `${week.activeDays} روز فعال · ${week.tests} تست`,
  }))

  const renderCard = (id: DashboardCardId) => {
    switch (id) {
      case 'today': {
        const activeSessions = state.studyDays.some(day => day.date === today && day.hours > 0) ? 1 : 0
        return (
          <Card key={id} title="مطالعهٔ امروز" subtitle={formatJalali(today, 'full')} action={<Activity size={18} />}>
            <div className="metric-hero">
              <strong>{formatHours(data.today.hours)}</strong>
              <span>از هدف روزانه {formatHours(data.goals.daily.target)}</span>
            </div>
            <ProgressBar value={data.goals.daily.percent} tone={data.goals.daily.percent >= 100 ? 'positive' : 'accent'} />
            <div className="stat-grid">
              <StatTile label="جلسهٔ مطالعه" value={faNumber(activeSessions, 0)} hint="ثبت ساعت امروز" />
              <StatTile label="تست امروز" value={faNumber(data.today.tests, 0)} hint={`${faNumber(data.today.correct, 0)} صحیح`} />
              <StatTile
                label="درصد امروز"
                value={formatPercent(data.today.percent)}
                hint={data.today.tests > 0 ? 'بر اساس مجموع پاسخ‌ها' : 'تستی ثبت نشده'}
                tone={data.today.percent !== null && data.today.percent >= 50 ? 'positive' : 'neutral'}
              />
            </div>
            {data.testsToday.length ? (
              <div className="mini-list">
                {data.testsToday.map(test => (
                  <div key={test.id} className="mini-row">
                    <span className="subject-dot" style={{ background: subjectColor(test.subjectName) }} />
                    <span>{test.subjectName}</span>
                    <span className="muted">{faNumber(test.total, 0)} تست</span>
                    <strong>{formatPercent((test.correct * 3 - test.wrong) / (test.total * 3) * 100)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="card-footer-actions">
              <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => onNavigate('performance', 'daily')}>
                ثبت مطالعه و تست
              </Button>
            </div>
          </Card>
        )
      }
      case 'goals':
        return (
          <Card
            key={id}
            title="هدف مطالعه"
            subtitle="درصد تحقق اهداف روزانه، هفتگی و ماهانه"
            action={<Button size="sm" variant="ghost" onClick={openGoals}>ویرایش هدف‌ها</Button>}
          >
            <div className="goal-stack">
              {([['روزانه', data.goals.daily], ['هفتگی', data.goals.weekly], ['ماهانه', data.goals.monthly]] as const).map(([label, goal]) => (
                <div key={label} className="goal-item">
                  <div className="goal-row">
                    <span>{label}</span>
                    <span className="muted">{faNumber(goal.value, 1)} از {faNumber(goal.target, 0)} ساعت</span>
                  </div>
                  <ProgressBar value={goal.percent} tone={goal.percent >= 100 ? 'positive' : 'violet'} compact />
                </div>
              ))}
            </div>
            <p className="small-note">
              هفته از شنبه شروع می‌شود و هدف ماهانه بر مبنای ماه شمسی محاسبه می‌شود.
            </p>
          </Card>
        )
      case 'reviews':
        return (
          <Card
            key={id}
            title="مرورها"
            subtitle="سررسید امروز، عقب‌افتاده و آینده"
            action={<Button size="sm" variant="ghost" icon={<CalendarClock size={15} />} onClick={() => onNavigate('planner', 'reviews')}>مدیریت</Button>}
          >
            <div className="stat-grid-4">
              <StatTile label="امروز" value={faNumber(data.reviews.today, 0)} tone={data.reviews.today > 0 ? 'accent' : 'neutral'} />
              <StatTile label="عقب‌افتاده" value={faNumber(data.reviews.overdue, 0)} tone={data.reviews.overdue > 0 ? 'danger' : 'neutral'} />
              <StatTile label="آینده" value={faNumber(data.reviews.upcoming, 0)} />
              <StatTile label="تکمیل‌شده" value={faNumber(data.reviews.completed, 0)} tone="positive" />
            </div>
            {pendingReviews.length ? (
              <div className="mini-list">
                {pendingReviews.slice(0, 3).map(review => {
                  const overdue = review.dueDate < today
                  return (
                    <div key={review.id} className="mini-row">
                      <span className="subject-dot" style={{ background: subjectColor(review.subjectName) }} />
                      <span>{review.topicName}</span>
                      <Badge tone={overdue ? 'danger' : review.dueDate === today ? 'info' : 'neutral'}>
                        {overdue ? `${faNumber(Math.abs(diffDaysISO(review.dueDate, today)), 0)} روز گذشته` : review.dueDate === today ? 'امروز' : formatJalali(review.dueDate, 'dayMonth')}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState title="مروری در انتظار نیست" description="با افزودن مبحث جدید، اولین مرور را برنامه‌ریزی کن." />
            )}
          </Card>
        )
      case 'exams':
        return (
          <Card
            key={id}
            title="عملکرد آزمونی"
            subtitle="میانگین درصد درس‌ها و آخرین آزمون‌ها"
            action={<Button size="sm" variant="ghost" onClick={() => onNavigate('performance', 'analysis')}>تحلیل کامل</Button>}
          >
            {data.subjects.length ? (
              <BarChart
                items={data.subjects.slice(0, 4).map(subject => ({
                  key: subject.subjectName,
                  label: subject.subjectName,
                  value: subject.average,
                  color: subjectColor(subject.subjectName),
                  hint: `${subject.count} آزمون`,
                }))}
                max={100}
                labelWidth={86}
              />
            ) : (
              <EmptyState title="آزمونی ثبت نشده" description="با ثبت اولین آزمون، میانگین و روند هر درس ساخته می‌شود." />
            )}
            <div className="trend-row">
              <Badge tone={data.examTrend.direction === 'up' ? 'positive' : data.examTrend.direction === 'down' ? 'danger' : 'neutral'}>
                {data.examTrend.direction === 'up' ? <TrendingUp size={13} /> : data.examTrend.direction === 'down' ? <TrendingDown size={13} /> : null}
                {data.examTrend.delta === null ? 'بدون روند' : `${faNumber(Math.abs(data.examTrend.delta), 1)} واحد ${data.examTrend.delta >= 0 ? 'بهبود' : 'افت'}`}
              </Badge>
              <span className="muted">آخرین {faNumber(data.recentExams.length, 0)} آزمون</span>
            </div>
            {data.recentExams.length ? (
              <div className="mini-list">
                {data.recentExams.slice(0, 3).map(item => (
                  <div key={item.exam.id} className="mini-row">
                    <span>{item.exam.title}</span>
                    <span className="muted">{formatJalali(item.exam.date, 'dayMonth')}</span>
                    <strong className={cx(item.percent !== null && item.percent < 35 && 'text-danger')}>{formatPercent(item.percent)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        )
      case 'courses': {
        const topCourses = [...data.courseList].sort((a, b) => b.progress.learningPercent - a.progress.learningPercent).slice(0, 3)
        return (
          <Card
            key={id}
            title="دوره‌های آموزشی"
            subtitle="پیشرفت ویدئویی و پیشرفت واقعی یادگیری، مستقل از هم"
            action={<Button size="sm" variant="ghost" icon={<PlayCircle size={15} />} onClick={() => onNavigate('courses')}>دوره‌ها</Button>}
          >
            <div className="ring-row">
              <div className="ring-block">
                <ProgressRing value={data.courses.videoPercent} label={`${faNumber(data.courses.videoPercent, 0)}٪`} />
                <span>پیشرفت ویدئویی</span>
              </div>
              <div className="ring-block">
                <ProgressRing value={data.courses.learningPercent} tone="var(--c-violet)" label={`${faNumber(data.courses.learningPercent, 0)}٪`} />
                <span>یادگیری واقعی</span>
              </div>
              <div className="ring-meta">
                <strong>{faNumber(data.courses.watchedSessions, 0)} از {faNumber(data.courses.totalSessions, 0)} جلسه</strong>
                <span>{faNumber(data.courses.remainingSessions, 0)} جلسه باقی‌مانده</span>
                <span>{faNumber(data.courses.totalCourses, 0)} دوره ثبت‌شده</span>
              </div>
            </div>
            {topCourses.length ? (
              <div className="mini-list">
                {topCourses.map(({ course, progress }) => (
                  <button key={course.id} type="button" className="mini-row mini-button" onClick={() => onNavigate('courses')}>
                    <span>{course.title}</span>
                    <span className="muted">{faNumber(progress.watchedSessions, 0)}/{faNumber(progress.totalSessions, 0)}</span>
                    <strong>{faNumber(progress.learningPercent, 0)}٪</strong>
                  </button>
                ))}
              </div>
            ) : <EmptyState title="دوره‌ای ثبت نشده" description="یک دورهٔ ویدئویی اضافه کن و جلسات آن را مدیریت کن." />}
          </Card>
        )
      }
      case 'debt':
        return (
          <Card
            key={id}
            title="بدهی مطالعاتی"
            subtitle="کارهای انجام‌نشده و نزدیک به موعد"
            action={<Button size="sm" variant="ghost" icon={<ListChecks size={15} />} onClick={() => onNavigate('planner', 'debt')}>مدیریت کارها</Button>}
          >
            <div className="stat-grid-4">
              <StatTile label="عقب‌افتاده" value={faNumber(data.debt.overdue, 0)} tone={data.debt.overdue > 0 ? 'danger' : 'neutral'} />
              <StatTile label="امروز" value={faNumber(data.debt.today, 0)} />
              <StatTile label="اولویت بالا" value={faNumber(data.debt.highPriority, 0)} tone={data.debt.highPriority > 0 ? 'warning' : 'neutral'} />
              <StatTile label="تکمیل‌شده" value={faNumber(data.debt.completed, 0)} tone="positive" />
            </div>
            {data.dueSoon.length ? (
              <div className="mini-list">
                {data.dueSoon.slice(0, 3).map(task => (
                  <div key={task.id} className="mini-row">
                    <span className={cx(task.priority === 'high' && 'text-danger')}>{task.title}</span>
                    <span className="muted">{formatJalali(task.dueDate, 'dayMonth')}</span>
                  </div>
                ))}
              </div>
            ) : <p className="small-note">کاری نزدیک به موعد نیست.</p>}
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="نمای کلی"
        title="داشبورد"
        description={`${formatJalali(today, 'full')} · خلاصهٔ وضعیت مطالعه، مرور و آزمون‌ها بر اساس داده‌های واقعی همین حساب`}
        actions={(
          <>
            <Button variant="secondary" icon={<CalendarClock size={16} />} onClick={() => onNavigate('planner', 'reviews')}>افزودن مرور</Button>
            <Button icon={<Plus size={16} />} onClick={() => onNavigate('performance', 'daily')}>ثبت مطالعهٔ امروز</Button>
          </>
        )}
      />

      {state.subjects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpenCheck size={26} />}
            title="هنوز درسی ثبت نشده"
            description="برای شروع، یک درس در بخش برنامه و مرور بساز."
            action={<Button onClick={() => onNavigate('planner', 'subjects')}>مدیریت درس‌ها</Button>}
          />
        </Card>
      ) : null}

      <div className="dashboard-grid">
        {orderedCards.map(card => renderCard(card.id))}
      </div>

      <div className="charts-grid">
        <Card
          title="نمودار ساعت مطالعه"
          subtitle="ساعت مطالعهٔ ثبت‌شده در هر روز"
          action={<Segmented
            ariaLabel="بازهٔ نمودار مطالعه"
            value={range}
            onChange={setRange}
            options={[{ value: '7', label: '۷ روز' }, { value: '14', label: '۱۴ روز' }, { value: '30', label: '۳۰ روز' }]}
          />}
        >
          <LineChart points={hourPoints} suffix=" ساعت" height={240} />
        </Card>

        <Card title="مطالعهٔ هفتگی" subtitle="شش هفتهٔ اخیر">
          <BarChart items={weekPoints} max={Math.max(state.settings.goals.weeklyHours, ...weekPoints.map(point => point.value))} suffix=" ساعت" emptyLabel="اطلاعات هفتگی موجود نیست" />
        </Card>

        <Card title="روند درصد آزمون‌ها" subtitle="میانگین وزنی نتایج آزمون‌ها در ۹۰ روز اخیر">
          <LineChart
            points={data.examSeries.map(point => ({ label: point.label, value: point.percent, meta: `${point.count} درس` }))}
            height={240}
            emptyLabel="برای نمایش روند، حداقل یک آزمون ثبت کن"
          />
        </Card>

        <Card title="مقایسهٔ عملکرد دروس" subtitle="میانگین درصد آزمون‌ها">
          <BarChart
            items={data.subjects.map(subject => ({
              key: subject.subjectName,
              label: subject.subjectName,
              value: subject.average,
              color: subjectColor(subject.subjectName),
              hint: `${subject.count} آزمون · بهترین ${formatPercent(subject.best)}`,
            }))}
            max={100}
            emptyLabel="آزمونی برای مقایسه ثبت نشده است"
          />
        </Card>

        <Card title="پیشرفت دوره‌ها" subtitle="پیشرفت واقعی یادگیری در برابر پیشرفت ویدئویی">
          <BarChart
            items={data.courseList.map(({ course, progress }) => ({
              key: course.id,
              label: course.title,
              value: progress.learningPercent,
              color: 'var(--c-violet)',
              hint: `ویدئو: ${faNumber(progress.videoPercent, 0)}٪ · ${faNumber(progress.watchedSessions, 0)} از ${faNumber(progress.totalSessions, 0)} جلسه`,
            }))}
            max={100}
            labelWidth={130}
            emptyLabel="دوره‌ای ثبت نشده است"
          />
        </Card>

        <Card title="مرورهای پیش‌رو" subtitle="نزدیک‌ترین سررسیدها">
          {pendingReviews.length ? (
            <div className="mini-list">
              {pendingReviews.slice(0, 6).map(review => (
                <div key={review.id} className="mini-row">
                  <span className="subject-dot" style={{ background: subjectColor(review.subjectName) }} />
                  <span>{review.subjectName} · {review.topicName}</span>
                  <Badge tone={review.dueDate < today ? 'danger' : review.dueDate === today ? 'info' : 'neutral'}>
                    {review.dueDate < today ? 'عقب‌افتاده' : review.dueDate === today ? 'امروز' : formatJalali(review.dueDate, 'dayMonth')}
                  </Badge>
                  <Badge tone="violet">{MASTERY_LABELS[review.mastery]}</Badge>
                </div>
              ))}
            </div>
          ) : <EmptyState title="مروری برنامه‌ریزی نشده" description="از بخش برنامه و مرور، اولین مرور را بساز." />}
        </Card>
      </div>

      <Modal
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        title="ویرایش هدف‌های مطالعه"
        subtitle="این مقادیر مبنای درصد تحقق هدف‌ها و گزارش‌ها هستند."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setGoalsOpen(false)}>انصراف</Button>
            <Button onClick={saveGoals} icon={<Target size={16} />}>ذخیرهٔ هدف‌ها</Button>
          </>
        )}
      >
        <div className="form-grid form-grid-3">
          <Field label="هدف روزانه (ساعت)">
            <Input inputMode="decimal" value={draft.daily} onChange={event => setDraft({ ...draft, daily: event.target.value })} />
          </Field>
          <Field label="هدف هفتگی (ساعت)">
            <Input inputMode="decimal" value={draft.weekly} onChange={event => setDraft({ ...draft, weekly: event.target.value })} />
          </Field>
          <Field label="هدف ماهانه (ساعت)">
            <Input inputMode="decimal" value={draft.monthly} onChange={event => setDraft({ ...draft, monthly: event.target.value })} />
          </Field>
        </div>
        {goalError ? <p className="form-error" role="alert">{goalError}</p> : null}
        <p className="small-note">هدف هفتگی پیش‌فرض ۳۵ و هدف ماهانهٔ پیش‌فرض ۱۵۰ ساعت است.</p>
      </Modal>

      <div className="dash-footnote">
        <Clock3 size={15} aria-hidden="true" />
        <span>همهٔ اعداد این صفحه از اطلاعات ثبت‌شده در حساب تو محاسبه می‌شوند؛ هیچ دادهٔ نمونه‌ای نمایش داده نمی‌شود.</span>
        <button type="button" className="link-button" onClick={() => onNavigate('reports', 'weekly')}>
          گزارش هفتگی <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  )
}

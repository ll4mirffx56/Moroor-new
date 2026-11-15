import { useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Award, ChevronLeft, ChevronRight, Flame, Lightbulb, Sparkles,
  TrendingUp, Trophy,
} from 'lucide-react'
import { useStore } from '../store/AppStore.js'
import {
  analyzeLearning, buildActivity, buildAchievements, buildMonthlyReport, buildWeeklyReport,
  buildWeeklyReview, heatmapWeeks,
} from '../lib/analytics.js'
import { courseProgress } from '../lib/courses.js'
import {
  addDaysISO, endOfWeekISO, faNumber, formatHours, formatJalali, formatPercent, faYear,
  isoToJalaliParts, PERSIAN_MONTHS, startOfWeekISO,
} from '../lib/date.js'
import { PALETTE_CSS } from '../lib/palette.js'
import { MASTERY_LABELS } from '../lib/review.js'
import {
  Badge, Button, Callout, Card, EmptyState, Modal, PageHeader, ProgressBar, StatTile, Tabs, cx,
} from '../components/ui.js'
import { ActivityHeatmap, BarChart, LineChart, ProgressRing, type HeatmapDay } from '../components/charts.js'

const TABS = [
  { key: 'weekly', label: 'گزارش هفتگی', icon: <Activity size={16} /> },
  { key: 'monthly', label: 'گزارش ماهانه', icon: <TrendingUp size={16} /> },
  { key: 'heatmap', label: 'تقویم فعالیت', icon: <Flame size={16} /> },
  { key: 'achievements', label: 'دستاوردها', icon: <Trophy size={16} /> },
  { key: 'analyst', label: 'تحلیل‌گر یادگیری', icon: <Sparkles size={16} /> },
] as const

export type ReportsTab = typeof TABS[number]['key']

export function ReportsPage({ tab, onTab }: { tab: string; onTab: (tab: ReportsTab) => void }) {
  const active = (TABS.some(item => item.key === tab) ? tab : 'weekly') as ReportsTab
  return (
    <div className="page">
      <PageHeader
        eyebrow="تحلیل"
        title="گزارش‌ها"
        description="گزارش‌های ساخته‌شده از داده‌های واقعی حساب، تقویم فعالیت، دستاوردها و تحلیل‌گر یادگیری"
      />
      <Tabs ariaLabel="بخش‌های گزارش" value={active} onChange={onTab} tabs={TABS} />
      {active === 'weekly' ? <WeeklyReportSection /> : null}
      {active === 'monthly' ? <MonthlyReportSection /> : null}
      {active === 'heatmap' ? <HeatmapSection /> : null}
      {active === 'achievements' ? <AchievementsSection /> : null}
      {active === 'analyst' ? <AnalystSection /> : null}
    </div>
  )
}

function WeeklyReportSection() {
  const { state, today } = useStore()
  const [offset, setOffset] = useState(0)
  const weekStart = startOfWeekISO(addDaysISO(today, offset * 7))
  const weekEnd = endOfWeekISO(weekStart)
  const report = useMemo(() => buildWeeklyReport(state, weekStart, today), [state, weekStart, today])
  const review = useMemo(() => buildWeeklyReview(state, weekStart, today), [state, weekStart, today])
  const daily = useMemo(() => buildActivity(state, weekStart, weekEnd), [state, weekStart, weekEnd])
  const subjectColor = (name: string) => PALETTE_CSS[state.subjects.find(subject => subject.name === name)?.color ?? 'blue']

  return (
    <div className="section-stack">
      <Card
        title="بازهٔ گزارش"
        subtitle={`${formatJalali(weekStart, 'long')} تا ${formatJalali(weekEnd, 'long')}`}
        action={(
          <div className="row-actions">
            <Button size="sm" variant="secondary" onClick={() => setOffset(value => value - 1)} aria-label="هفتهٔ قبل"><ChevronRight size={16} /></Button>
            <Button size="sm" variant="ghost" onClick={() => setOffset(0)} disabled={offset === 0}>هفتهٔ جاری</Button>
            <Button size="sm" variant="secondary" onClick={() => setOffset(value => Math.min(0, value + 1))} disabled={offset >= 0} aria-label="هفتهٔ بعد"><ChevronLeft size={16} /></Button>
          </div>
        )}
      >
        <div className="stat-grid-4">
          <StatTile label="ساعت مطالعه" value={formatHours(report.stats.hours)} hint={`${formatPercent(report.stats.goalPercent)} از هدف هفتگی`} tone={report.stats.goalPercent >= 100 ? 'positive' : 'neutral'} />
          <StatTile label="روز فعال" value={`${faNumber(report.stats.activeDays, 0)} از ۷`} hint={`${formatHours(report.stats.plannedHours)} برنامه‌ریزی‌شده`} />
          <StatTile label="تست" value={faNumber(report.stats.tests.total, 0)} hint={`درصد ${formatPercent(report.stats.tests.percent)}`} />
          <StatTile label="مرور تکمیل‌شده" value={faNumber(report.stats.reviews.completed, 0)} hint={`${faNumber(report.stats.reviews.due, 0)} سررسید در این هفته`} />
          <StatTile label="میانگین آزمون" value={formatPercent(report.stats.exams.percent)} hint={`${faNumber(report.stats.exams.count, 0)} آزمون`} />
          <StatTile label="کار انجام‌شده" value={faNumber(report.stats.tasks.completed, 0)} hint={`${faNumber(report.stats.tasks.created, 0)} کار ایجادشده`} />
          <StatTile label="عقب‌افتاده (اکنون)" value={faNumber(report.reviewsNow.overdue, 0)} tone={report.reviewsNow.overdue ? 'danger' : 'neutral'} />
          <StatTile label="بدهی باز" value={faNumber(report.debt.open, 0)} hint={`${faNumber(report.debt.overdue, 0)} عقب‌افتاده`} />
        </div>

        <div className="comparison-row">
          <Comparison label="ساعت مطالعه" value={report.changes.hours} suffix=" ساعت" />
          <Comparison label="تست" value={report.changes.tests} suffix=" تست" />
          <Comparison label="روز فعال" value={report.changes.activeDays} suffix=" روز" />
          <Comparison label="میانگین آزمون" value={report.changes.exam} suffix=" واحد" />
        </div>
        <p className="small-note">مقایسه با هفتهٔ قبل ({formatJalali(addDaysISO(weekStart, -7), 'dayMonth')} تا {formatJalali(addDaysISO(weekStart, -1), 'dayMonth')}).</p>
      </Card>

      <div className="charts-grid">
        <Card title="مطالعهٔ روزانهٔ هفته" subtitle="ساعت مطالعه و تعداد تست هر روز">
          <BarChart
            items={daily.map(day => ({
              key: day.date,
              label: formatJalali(day.date, 'dayMonth'),
              value: Math.round(day.hours * 10) / 10,
              color: day.hours > 0 ? 'var(--accent)' : 'var(--line-strong)',
              hint: `${day.tests} تست`,
            }))}
            max={Math.max(8, ...daily.map(day => day.hours))}
            suffix=" ساعت"
            labelWidth={92}
          />
        </Card>
        <Card title="عملکرد دروس" subtitle="میانگین درصد آزمون‌های هفته">
          <BarChart
            items={report.subjectStats.map(item => ({
              key: item.subjectName,
              label: item.subjectName,
              value: item.average,
              color: subjectColor(item.subjectName),
              hint: `${item.count} نتیجه`,
            }))}
            max={100}
            emptyLabel="این هفته آزمونی ثبت نشده است"
          />
        </Card>
      </div>

      <Card title="تحلیل هفتگی" subtitle="نقاط قوت، مشکلات و پیشنهادهای عملی برای هفتهٔ بعد">
        {!review.sufficientData ? (
          <Callout tone="warning" title="داده کافی برای جمع‌بندی نیست">
            {review.caveats[0] ?? 'برای تحلیل هفتگی دادهٔ بیشتری لازم است.'}
          </Callout>
        ) : (
          <div className="insight-grid">
            <div className="insight-block">
              <h3 className="subhead"><TrendingUp size={16} /> نقاط قوت</h3>
              {review.strengths.length ? review.strengths.map((item, index) => <p key={index} className="insight-line positive">{item}</p>) : <p className="muted">مورد قابل ذکری ثبت نشده است.</p>}
            </div>
            <div className="insight-block">
              <h3 className="subhead"><AlertTriangle size={16} /> مهم‌ترین مشکلات</h3>
              {review.problems.length ? review.problems.map((item, index) => <p key={index} className="insight-line warning">{item}</p>) : <p className="muted">مشکل مشخصی دیده نمی‌شود.</p>}
            </div>
            <div className="insight-block">
              <h3 className="subhead">تغییر درس‌ها</h3>
              <p className={cx('insight-line', review.mostImproved ? 'positive' : 'muted')}>
                بیشترین پیشرفت: {review.mostImproved ? `${review.mostImproved.subjectName} (${faNumber(review.mostImproved.delta, 1)} واحد)` : 'داده‌ای برای مقایسه نیست'}
              </p>
              <p className={cx('insight-line', review.mostDeclined ? 'warning' : 'muted')}>
                بیشترین افت: {review.mostDeclined ? `${review.mostDeclined.subjectName} (${faNumber(Math.abs(review.mostDeclined.delta), 1)} واحد)` : 'داده‌ای برای مقایسه نیست'}
              </p>
              <p className="muted small">اعتبار تحلیل: {review.confidence} · بر اساس داده‌های ثبتی همین هفته</p>
            </div>
            <div className="insight-block">
              <h3 className="subhead"><Lightbulb size={16} /> پیشنهادها</h3>
              {review.suggestions.length ? review.suggestions.map((item, index) => <p key={index} className="insight-line">{item}</p>) : <p className="muted">پیشنهاد خاصی لازم نیست.</p>}
            </div>
          </div>
        )}
      </Card>

      <div className="charts-grid">
        <Card title="بدهی مطالعاتی هفته" subtitle="وضعیت فعلی کارها">
          <div className="stat-grid">
            <StatTile label="عقب‌افتاده" value={faNumber(report.debt.overdue, 0)} tone={report.debt.overdue ? 'danger' : 'neutral'} />
            <StatTile label="امروز" value={faNumber(report.debt.today, 0)} />
            <StatTile label="نزدیک موعد" value={faNumber(report.debt.dueSoon, 0)} />
          </div>
          {report.stats.tasks.completed === 0 && report.stats.tasks.created === 0
            ? <p className="small-note">این هفته کاری در بخش بدهی مطالعاتی ایجاد یا تکمیل نشده است.</p>
            : <ProgressBar label="نسبت کارهای تکمیل‌شدهٔ این هفته" value={report.stats.tasks.created > 0 ? (report.stats.tasks.completed / Math.max(1, report.stats.tasks.created)) * 100 : 0} />}
        </Card>
        <Card title="مرورهای هفته" subtitle="سررسید در برابر انجام‌شده">
          <div className="stat-grid">
            <StatTile label="تکمیل‌شده" value={faNumber(report.stats.reviews.completed, 0)} tone="positive" />
            <StatTile label="سررسید" value={faNumber(report.stats.reviews.due, 0)} />
            <StatTile label="اکنون عقب‌افتاده" value={faNumber(report.reviewsNow.overdue, 0)} tone={report.reviewsNow.overdue ? 'danger' : 'neutral'} />
          </div>
          <ProgressBar
            label="نسبت مرورهای انجام‌شده"
            value={report.stats.reviews.due > 0 ? Math.min(100, (report.stats.reviews.completed / report.stats.reviews.due) * 100) : 0}
            tone="positive"
          />
        </Card>
      </div>
    </div>
  )
}

function Comparison({ label, value, suffix }: { label: string; value: number | null; suffix: string }) {
  if (value === null) return <Badge tone="neutral">{label}: بدون مقایسه</Badge>
  const rounded = Math.round(value * 10) / 10
  return (
    <Badge tone={rounded > 0 ? 'positive' : rounded < 0 ? 'danger' : 'neutral'}>
      {label}: {rounded > 0 ? '+' : ''}{faNumber(rounded, 1)}{suffix}
    </Badge>
  )
}

function MonthlyReportSection() {
  const { state, today } = useStore()
  const report = useMemo(() => buildMonthlyReport(state, today), [state, today])
  const parts = isoToJalaliParts(today)
  const subjectColor = (name: string) => PALETTE_CSS[state.subjects.find(subject => subject.name === name)?.color ?? 'blue']

  return (
    <div className="section-stack">
      <Card
        title={`گزارش ${parts ? `${PERSIAN_MONTHS[parts.jm - 1]} ${faYear(parts.jy)}` : 'ماه'}`}
        subtitle={`${formatJalali(report.start, 'long')} تا ${formatJalali(report.end, 'long')}`}
      >
        <div className="stat-grid-4">
          <StatTile label="ساعت مطالعه" value={formatHours(report.stats.hours)} hint={`${formatPercent(report.stats.goalPercent)} از هدف ماهانه`} />
          <StatTile label="روز فعال" value={faNumber(report.stats.activeDays, 0)} hint={`از ${faNumber(Math.max(1, report.weeks.length * 7), 0)} روز تقویمی`} />
          <StatTile label="تست" value={faNumber(report.stats.tests.total, 0)} hint={`درصد ${formatPercent(report.stats.tests.percent)}`} />
          <StatTile label="میانگین آزمون" value={formatPercent(report.stats.exams.percent)} hint={`${faNumber(report.stats.exams.count, 0)} آزمون`} />
        </div>
        <ProgressBar label="تحقق هدف ماهانه" value={report.monthlyGoal.percent} tone="violet" />
      </Card>

      <div className="charts-grid">
        <Card title="روند مطالعهٔ هفتگی" subtitle="ساعت مطالعه در هفته‌های این ماه">
          <LineChart
            points={report.weeks.map(week => ({ label: week.label, value: week.hours, meta: `${week.tests} تست` }))}
            suffix=" ساعت"
            height={240}
            emptyLabel="اطلاعات مطالعه‌ای در این ماه ثبت نشده است"
          />
        </Card>
        <Card title="روند آزمون‌ها" subtitle="درصد وزنی آزمون‌های ماه">
          <LineChart
            points={report.examSeries.map(point => ({ label: point.label, value: point.percent, meta: `${point.count} نتیجه` }))}
            height={240}
            emptyLabel="این ماه آزمونی ثبت نشده است"
          />
        </Card>
      </div>

      <div className="charts-grid">
        <Card title="عملکرد دروس" subtitle="میانگین درصد آزمون‌های ماه">
          <BarChart
            items={report.subjectStats.map(item => ({
              key: item.subjectName,
              label: item.subjectName,
              value: item.average,
              color: subjectColor(item.subjectName),
              hint: `${item.count} نتیجه`,
            }))}
            max={100}
            emptyLabel="داده‌ای برای مقایسه نیست"
          />
        </Card>
        <Card title="پیشرفت دوره‌ها" subtitle="وضعیت فعلی دوره‌های آموزشی">
          {report.courseProgress.length ? (
            <div className="plain-list">
              {state.courses.map((course, index) => {
                const progress = report.courseProgress[index] ?? courseProgress(course, state.settings.lessonWeights)
                return (
                  <div key={course.id} className="plain-row">
                    <div>
                      <strong>{course.title}</strong>
                      <span className="muted">{faNumber(progress.watchedSessions, 0)} از {faNumber(progress.totalSessions, 0)} جلسه · ویدئو {formatPercent(progress.videoPercent)}</span>
                    </div>
                    <ProgressBar value={progress.learningPercent} tone="violet" compact />
                  </div>
                )
              })}
            </div>
          ) : <EmptyState title="دوره‌ای ثبت نشده" description="برای مشاهدهٔ پیشرفت ماهانه، یک دوره و جلسات آن را ثبت کن." />}
        </Card>
      </div>

      <Card title="مرور و بدهی" subtitle="وضعیت پایان ماه">
        <div className="stat-grid-4">
          <StatTile label="مرور امروز" value={faNumber(report.reviewsNow.today, 0)} />
          <StatTile label="مرور عقب‌افتاده" value={faNumber(report.reviewsNow.overdue, 0)} tone={report.reviewsNow.overdue ? 'danger' : 'neutral'} />
          <StatTile label="کار باز" value={faNumber(report.debt.open, 0)} />
          <StatTile label="کار تکمیل‌شده" value={faNumber(report.debt.completed, 0)} tone="positive" />
        </div>
      </Card>
    </div>
  )
}

function HeatmapSection() {
  const { state, today } = useStore()
  const weeks = useMemo(() => heatmapWeeks(state, today, 26), [state, today])
  const [selected, setSelected] = useState<HeatmapDay | null>(null)

  const monthLabels = weeks.map((week, index) => {
    const first = week.days[0]
    const parts = isoToJalaliParts(first.date)
    if (!parts) return ''
    const previousParts = index > 0 ? isoToJalaliParts(weeks[index - 1].days[0].date) : null
    return !previousParts || previousParts.jm !== parts.jm ? PERSIAN_MONTHS[parts.jm - 1] : ''
  })

  return (
    <div className="section-stack">
      <Card title="تقویم فعالیت" subtitle="شدت فعالیت ۲۶ هفتهٔ اخیر بر اساس ساعت مطالعه، تست، مرور و کارهای تکمیل‌شده">
        <ActivityHeatmap
          weeks={weeks}
          monthLabels={monthLabels}
          weekdayLabels={['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']}
          onSelect={setSelected}
        />
        <p className="small-note">رنگ هر روز از فعالیت ثبت‌شده در همان روز ساخته می‌شود. برای دیدن جزئیات روی روز بزن.</p>
      </Card>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? formatJalali(selected.date, 'full') : ''} size="sm">
        {selected ? (
          <div className="stat-grid">
            <StatTile label="ساعت مطالعه" value={formatHours(selected.hours)} />
            <StatTile label="تست" value={faNumber(selected.tests, 0)} hint={formatPercent(selected.percent)} />
            <StatTile label="مرور انجام‌شده" value={faNumber(selected.reviewsCompleted, 0)} />
            <StatTile label="کار تکمیل‌شده" value={faNumber(selected.tasksCompleted, 0)} />
            <StatTile label="آزمون" value={faNumber(selected.exams, 0)} />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function AchievementsSection() {
  const { state, today } = useStore()
  const achievements = useMemo(() => buildAchievements(state, today), [state, today])
  const achieved = achievements.filter(item => item.achieved).length
  return (
    <div className="section-stack">
      <Card title="دستاوردها" subtitle="پیشرفت واقعی، بدون مقایسه با دیگران یا فشار برای مطالعهٔ افراطی">
        <div className="achievement-summary">
          <ProgressRing value={(achieved / achievements.length) * 100} size={86} label={`${faNumber(achieved, 0)}/${faNumber(achievements.length, 0)}`} />
          <div>
            <strong>{faNumber(achieved, 0)} دستاورد از {faNumber(achievements.length, 0)}</strong>
            <p className="muted">دستاوردها از داده‌های ثبت‌شده محاسبه می‌شوند و با حذف داده، وضعیتشان دوباره ارزیابی می‌شود.</p>
          </div>
        </div>
        <div className="achievement-grid">
          {achievements.map(item => (
            <div key={item.id} className={cx('achievement-card', item.achieved && 'achievement-done')}>
              <span className="achievement-icon" aria-hidden="true">{item.achieved ? <Award size={20} /> : <Trophy size={20} />}</span>
              <div>
                <strong>{item.title}</strong>
                <p className="muted">{item.description}</p>
                <ProgressBar value={item.percent} tone={item.achieved ? 'positive' : 'accent'} compact />
                <span className="achievement-detail">{item.detail}</span>
              </div>
              {item.achieved ? <Badge tone="positive">کسب شد</Badge> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function AnalystSection() {
  const { state, today } = useStore()
  const analysis = useMemo(() => analyzeLearning(state, today), [state, today])
  return (
    <div className="section-stack">
      <Card title="تحلیل‌گر یادگیری" subtitle="تحلیل قطعی و قابل‌تأیید بر پایهٔ داده‌های همین حساب">
        {!analysis.enoughData ? (
          <Callout tone="warning" title="دادهٔ کافی وجود ندارد">
            {analysis.dataNote}
          </Callout>
        ) : (
          <>
            <div className="analyst-columns">
              <div>
                <h3 className="subhead"><Activity size={16} /> واقعیت‌های ثبت‌شده</h3>
                {analysis.facts.length ? analysis.facts.map(insight => (
                  <div key={insight.id} className={cx('analyst-card', `analyst-${insight.tone}`)}>
                    <strong>{insight.title}</strong>
                    <p>{insight.detail}</p>
                    <ul>{insight.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </div>
                )) : <p className="muted">واقعیت قابل توجهی برای نمایش نیست.</p>}
              </div>
              <div>
                <h3 className="subhead"><Lightbulb size={16} /> پیشنهادها</h3>
                {analysis.suggestions.length ? analysis.suggestions.map(insight => (
                  <div key={insight.id} className="analyst-card analyst-suggestion">
                    <strong>{insight.title}</strong>
                    <p>{insight.detail}</p>
                    <ul>{insight.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
                  </div>
                )) : <p className="muted">پیشنهاد خاصی لازم نیست؛ روند فعلی را ادامه بده.</p>}
              </div>
            </div>
            <p className="small-note">{analysis.dataNote}</p>
          </>
        )}
        <Callout tone="info" title="دربارهٔ این تحلیل">
          این بخش با قواعد شفاف و روی داده‌های محلی کار می‌کند؛ هیچ اطلاعاتی به سرویس خارجی ارسال نمی‌شود. پیشنهادها
          از واقعیت‌های ثبت‌شده جدا نمایش داده می‌شوند و تصمیم نهایی با توست. معماری این لایه برای اتصال آیندهٔ یک مدل
          هوش مصنوعی آماده است، اما تا اتصال، هیچ ادعایی دربارهٔ تحلیل هوشمند خارجی وجود ندارد.
        </Callout>
      </Card>

      <Card title="خلاصهٔ مرور" subtitle="وضعیت فعلی بر اساس تاریخ سررسید">
        <div className="stat-grid-4">
          {Object.entries({
            امروز: state.reviews.filter(review => review.status !== 'completed' && review.dueDate === today).length,
            عقب‌افتاده: state.reviews.filter(review => review.status !== 'completed' && review.dueDate < today).length,
            آینده: state.reviews.filter(review => review.status !== 'completed' && review.dueDate > today).length,
            انجام‌شده: state.reviews.filter(review => review.status === 'completed').length,
          }).map(([label, value]) => <StatTile key={label} label={label} value={faNumber(value, 0)} />)}
        </div>
        {state.reviews.some(review => review.status !== 'completed') ? (
          <div className="mini-list">
            {state.reviews.filter(review => review.status !== 'completed').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4).map(review => (
              <div key={review.id} className="mini-row">
                <span>{review.subjectName} · {review.topicName}</span>
                <Badge tone={review.dueDate < today ? 'danger' : 'neutral'}>{formatJalali(review.dueDate, 'dayMonth')}</Badge>
                <Badge tone="violet">{MASTERY_LABELS[review.mastery]}</Badge>
              </div>
            ))}
          </div>
        ) : <EmptyState title="مروری در انتظار نیست" description="مرورهای انجام‌شده در گزارش‌ها لحاظ می‌شوند." />}
      </Card>
    </div>
  )
}

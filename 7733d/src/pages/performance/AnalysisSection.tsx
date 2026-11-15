import { useMemo, useState } from 'react'
import { ChartLine, TrendingDown, TrendingUp } from 'lucide-react'
import { useStore } from '../../store/AppStore.js'
import { examSeries, recentExams, subjectStats, topicStats } from '../../lib/analytics.js'
import { aggregatePercent, examPercent } from '../../lib/exam.js'
import { addDaysISO, faNumber, formatJalali, formatPercent } from '../../lib/date.js'
import { PALETTE_CSS } from '../../lib/palette.js'
import { Badge, Card, EmptyState, Modal, Segmented, Select, StatTile } from '../../components/ui.js'
import { BarChart, LineChart } from '../../components/charts.js'
import type { Exam } from '../../lib/model.js'

export function AnalysisSection() {
  const { state, today } = useStore()
  const [range, setRange] = useState<'30' | '90' | '180' | 'all'>('90')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const windowStart = range === 'all' ? undefined : addDaysISO(today, -(Number(range) - 1))
  const stats = useMemo(() => subjectStats(state, today, windowStart), [state, today, windowStart])
  const topics = useMemo(() => topicStats(state, windowStart), [state, windowStart])
  const series = useMemo(
    () => examSeries(state, windowStart ?? '1900-01-01', today, subjectFilter === 'all' ? undefined : subjectFilter),
    [state, today, windowStart, subjectFilter],
  )
  const recent = useMemo(() => recentExams(state, 8), [state])
  const subjectColor = (name: string) => PALETTE_CSS[state.subjects.find(subject => subject.name === name)?.color ?? 'blue']

  const selectedExams: Exam[] = selectedDate
    ? state.exams.filter(exam => exam.date === selectedDate && (subjectFilter === 'all' || exam.results.some(result => result.subjectName === subjectFilter)))
    : []

  const best = [...stats].filter(item => item.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0]
  const weakest = [...stats].filter(item => item.average !== null).sort((a, b) => (a.average ?? 0) - (b.average ?? 0))[0]

  return (
    <div className="section-stack">
      <div className="stat-grid-4">
        <StatTile label="درس دارای آزمون" value={faNumber(stats.length, 0)} hint={`${faNumber(state.exams.length, 0)} آزمون ثبت‌شده`} />
        <StatTile label="بهترین میانگین" value={best ? formatPercent(best.average) : '—'} hint={best?.subjectName ?? 'بدون داده'} tone="positive" />
        <StatTile label="ضعیف‌ترین میانگین" value={weakest ? formatPercent(weakest.average) : '—'} hint={weakest?.subjectName ?? 'بدون داده'} tone="warning" />
        <StatTile label="مبحث تحلیل‌شده" value={faNumber(topics.length, 0)} hint="بر پایهٔ نتایج آزمون‌ها" />
      </div>

      <Card
        title="روند درصد آزمون‌ها"
        subtitle="میانگین وزنی نتایج هر روز؛ برای دیدن جزئیات روی نقطه بزن"
        action={<Segmented
          ariaLabel="بازهٔ تحلیل"
          value={range}
          onChange={setRange}
          options={[{ value: '30', label: '۳۰ روز' }, { value: '90', label: '۹۰ روز' }, { value: '180', label: '۱۸۰ روز' }, { value: 'all', label: 'همه' }]}
        />}
      >
        <div className="filter-bar">
          <Select
            aria-label="فیلتر درس در نمودار"
            value={subjectFilter}
            onChange={event => setSubjectFilter(event.target.value)}
            options={[{ value: 'all', label: 'همهٔ درس‌ها' }, ...stats.map(item => ({ value: item.subjectName, label: item.subjectName }))]}
          />
        </div>
        <LineChart
          points={series.map(point => ({ label: point.label, value: point.percent, meta: `${point.count} نتیجه` }))}
          height={260}
          onSelect={(_point, index) => setSelectedDate(series[index]?.date ?? null)}
          emptyLabel="در این بازه آزمونی ثبت نشده است"
        />
      </Card>

      <div className="charts-grid">
        <Card title="مقایسهٔ دروس" subtitle="میانگین درصد آزمون‌ها">
          <BarChart
            items={stats.map(item => ({
              key: item.subjectName,
              label: item.subjectName,
              value: item.average,
              color: subjectColor(item.subjectName),
              hint: `${item.count} آزمون · آخرین ${formatPercent(item.last)}`,
            }))}
            max={100}
            emptyLabel="داده‌ای برای مقایسه نیست"
          />
        </Card>
        <Card title="مقایسهٔ مباحث" subtitle="کمترین میانگین‌ها اولویت بالاتری دارند">
          <BarChart
            items={[...topics].slice(0, 10).map(item => ({
              key: `${item.subjectName}-${item.topicName}`,
              label: item.topicName,
              value: item.average,
              color: subjectColor(item.subjectName),
              hint: `${item.subjectName} · ${item.count} آزمون`,
            }))}
            max={100}
            labelWidth={126}
            emptyLabel="برای مقایسهٔ مبحث، آزمون دارای مبحث ثبت کن"
          />
        </Card>
      </div>

      <Card title="تحلیل درس" subtitle="میانگین ۷، ۳۰ و ۹۰ روز، بهترین و ضعیف‌ترین درصد و روند تغییر">
        {stats.length ? (
          <div className="table-wrap">
            <table className="data-table analysis-table">
              <thead>
                <tr>
                  <th>درس</th>
                  <th>تعداد</th>
                  <th>میانگین ۷ روز</th>
                  <th>میانگین ۳۰ روز</th>
                  <th>میانگین ۹۰ روز</th>
                  <th>بهترین</th>
                  <th>ضعیف‌ترین</th>
                  <th>روند</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(item => (
                  <tr key={item.subjectName}>
                    <td><span className="subject-dot" style={{ background: subjectColor(item.subjectName) }} />{item.subjectName}</td>
                    <td>{faNumber(item.count, 0)}</td>
                    <td>{formatPercent(item.recent7)}</td>
                    <td>{formatPercent(item.recent30)}</td>
                    <td>{formatPercent(item.recent90)}</td>
                    <td>{formatPercent(item.best)}</td>
                    <td>{formatPercent(item.worst)}</td>
                    <td>
                      <Badge tone={item.direction === 'up' ? 'positive' : item.direction === 'down' ? 'danger' : 'neutral'}>
                        {item.direction === 'up' ? <TrendingUp size={13} /> : item.direction === 'down' ? <TrendingDown size={13} /> : null}
                        {item.delta === null ? 'بدون روند' : `${faNumber(Math.abs(item.delta), 1)} واحد`}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<ChartLine size={26} />} title="تحلیل درسی موجود نیست" description="پس از ثبت آزمون، میانگین‌ها و روند هر درس ساخته می‌شود." />}
      </Card>

      <Card title="آزمون‌های اخیر" subtitle="آخرین نتایج ثبت‌شده">
        {recent.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>آزمون</th><th>تاریخ</th><th>درس‌ها</th><th>سؤال</th><th>درصد کل</th></tr></thead>
              <tbody>
                {recent.map(item => (
                  <tr key={item.exam.id}>
                    <td>{item.exam.title}</td>
                    <td>{formatJalali(item.exam.date, 'long')}</td>
                    <td>{faNumber(item.exam.results.length, 0)}</td>
                    <td>{faNumber(item.total, 0)}</td>
                    <td><strong>{formatPercent(item.percent)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="آزمونی ثبت نشده" description="از تب آزمون‌ها اولین آزمون را ثبت کن." />}
      </Card>

      <Modal
        open={Boolean(selectedDate)}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? `آزمون‌های ${formatJalali(selectedDate, 'long')}` : ''}
        size="lg"
      >
        {selectedExams.length ? (
          <div className="form-stack">
            {selectedExams.map(exam => (
              <div key={exam.id} className="exam-detail-block">
                <div className="exam-title-row">
                  <strong>{exam.title}</strong>
                  <Badge tone="violet">{formatPercent(aggregatePercent(exam.results))}</Badge>
                </div>
                <div className="table-wrap">
                  <table className="data-table compact">
                    <thead><tr><th>درس</th><th>مبحث</th><th>کل</th><th>درصد</th></tr></thead>
                    <tbody>
                      {exam.results.map(result => (
                        <tr key={result.id}>
                          <td>{result.subjectName}</td>
                          <td>{result.topicName || '—'}</td>
                          <td>{faNumber(result.total, 0)}</td>
                          <td>{formatPercent(examPercent(result))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="جزئیاتی پیدا نشد" description="نتیجه‌ای برای این روز موجود نیست." />}
      </Modal>
    </div>
  )
}

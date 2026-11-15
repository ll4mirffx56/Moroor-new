import { Activity, ChartLine, ClipboardList } from 'lucide-react'
import { PageHeader, Tabs } from '../../components/ui.js'
import { DailySection } from './DailySection.js'
import { ExamsSection } from './ExamsSection.js'
import { AnalysisSection } from './AnalysisSection.js'
import { useStore } from '../../store/AppStore.js'
import { buildDashboard } from '../../lib/analytics.js'
import { formatPercent } from '../../lib/date.js'

const TABS = [
  { key: 'daily', label: 'عملکرد روزانه', icon: <Activity size={16} /> },
  { key: 'exams', label: 'آزمون‌ها', icon: <ClipboardList size={16} /> },
  { key: 'analysis', label: 'تحلیل آزمون', icon: <ChartLine size={16} /> },
] as const

export type PerformanceTab = typeof TABS[number]['key']

export function PerformancePage({ tab, onTab }: { tab: string; onTab: (tab: PerformanceTab) => void }) {
  const { state, today } = useStore()
  const data = buildDashboard(state, today)
  const active = (TABS.some(item => item.key === tab) ? tab : 'daily') as PerformanceTab
  const todayPercent = data.today.tests > 0
    ? formatPercent(((data.today.correct * 3 - data.today.wrong) / (data.today.tests * 3)) * 100)
    : '—'
  return (
    <div className="page">
      <PageHeader
        eyebrow="سنجش"
        title="عملکرد آزمونی"
        description="ثبت تست‌های روزانه با محاسبهٔ خودکار نزده، تحلیل آزمون‌ها و مقایسهٔ درس و مبحث"
        actions={<span className="header-chip">درصد امروز: {todayPercent}</span>}
      />
      <Tabs ariaLabel="بخش‌های عملکرد" value={active} onChange={onTab} tabs={TABS} />
      {active === 'daily' ? <DailySection /> : null}
      {active === 'exams' ? <ExamsSection /> : null}
      {active === 'analysis' ? <AnalysisSection /> : null}
    </div>
  )
}

import { CalendarDays, Layers, ListChecks } from 'lucide-react'
import { PageHeader, Tabs } from '../../components/ui.js'
import { ReviewsSection } from './ReviewsSection.js'
import { SubjectsSection } from './SubjectsSection.js'
import { DebtSection } from './DebtSection.js'
import { useStore } from '../../store/AppStore.js'
import { buildDashboard } from '../../lib/analytics.js'

const TABS = [
  { key: 'reviews', label: 'مرورها', icon: <CalendarDays size={16} /> },
  { key: 'subjects', label: 'درس و مبحث', icon: <Layers size={16} /> },
  { key: 'debt', label: 'بدهی مطالعاتی', icon: <ListChecks size={16} /> },
] as const

export type PlannerTab = typeof TABS[number]['key']

export function PlannerPage({ tab, onTab }: { tab: string; onTab: (tab: PlannerTab) => void }) {
  const { state, today } = useStore()
  const dashboard = buildDashboard(state, today)
  const active = (TABS.some(item => item.key === tab) ? tab : 'reviews') as PlannerTab
  return (
    <div className="page">
      <PageHeader
        eyebrow="برنامه‌ریزی"
        title="برنامه و مرور"
        description="مرور فاصله‌دار، مدیریت درس و مبحث و کارهای انجام‌نشده در یک جا"
        actions={<span className="header-chip"><CalendarDays size={15} /> {state.reviews.length.toLocaleString('fa-IR')} مرور ثبت‌شده</span>}
      />
      <Tabs
        ariaLabel="بخش‌های برنامه و مرور"
        value={active}
        onChange={onTab}
        tabs={TABS.map(item => ({
          ...item,
          count: item.key === 'reviews'
            ? dashboard.reviews.today + dashboard.reviews.overdue
            : item.key === 'debt'
              ? dashboard.debt.open
              : undefined,
        }))}
      />
      {active === 'reviews' ? <ReviewsSection /> : null}
      {active === 'subjects' ? <SubjectsSection /> : null}
      {active === 'debt' ? <DebtSection /> : null}
    </div>
  )
}

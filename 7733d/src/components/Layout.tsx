import { useState, type ReactNode } from 'react'
import {
  CalendarCheck2, Cloud, CloudOff, FileBarChart2, LayoutDashboard, LineChart, Loader2, LogOut,
  NotebookPen, PlayCircle, RefreshCw, TriangleAlert, UserRound,
} from 'lucide-react'
import type { SectionKey } from '../store/useRoute.js'
import { useStore } from '../store/AppStore.js'
import { formatHours, formatJalali, faNumber, tehranTimeLabel } from '../lib/date.js'
import { Badge, Button, IconButton, cx } from './ui.js'

const NAV = [
  { key: 'dashboard' as const, label: 'داشبورد', icon: LayoutDashboard },
  { key: 'planner' as const, label: 'برنامه و مرور', icon: CalendarCheck2 },
  { key: 'performance' as const, label: 'عملکرد آزمونی', icon: LineChart },
  { key: 'courses' as const, label: 'دوره‌های آموزشی', icon: PlayCircle },
  { key: 'reports' as const, label: 'گزارش‌ها', icon: FileBarChart2 },
  { key: 'notes' as const, label: 'یادداشت و تنظیمات', icon: NotebookPen },
]

function SyncIndicator() {
  const { sync, localMode } = useStore()
  const [expanded, setExpanded] = useState(false)
  const label = localMode
    ? 'حالت محلی'
    : sync.status === 'loading'
      ? 'در حال بارگذاری'
      : sync.status === 'saving'
        ? 'در حال ذخیره'
        : sync.status === 'synced'
          ? 'همگام'
          : sync.status === 'offline'
            ? 'آفلاین'
            : sync.status === 'error'
              ? 'خطای همگام‌سازی'
              : 'آماده'
  const icon = localMode || sync.status === 'offline'
    ? <CloudOff size={14} />
    : sync.status === 'loading' || sync.status === 'saving'
      ? <Loader2 size={14} className="spin" />
      : sync.status === 'error'
        ? <TriangleAlert size={14} />
        : <Cloud size={14} />
  return (
    <div className={cx('sync-indicator', `sync-${localMode ? 'local' : sync.status}`)}>
      <button type="button" className="sync-button" onClick={() => setExpanded(state => !state)} aria-expanded={expanded}>
        {icon}
        <span>{label}</span>
        {sync.pending ? <i className="sync-dot" aria-label="تغییر ذخیره‌نشده" /> : null}
      </button>
      {expanded ? (
        <div className="sync-popover" role="status">
          <p>{localMode
            ? 'اطلاعات فقط روی همین مرورگر ذخیره می‌شود. برای همگام‌سازی بین دستگاه‌ها، حساب Supabase را تنظیم کن.'
            : 'ذخیره‌سازی خودکار با مقایسهٔ نسخه انجام می‌شود؛ تعارض‌ها بی‌صدا حذف نمی‌شوند.'}</p>
          {sync.lastSyncedAt ? <p>آخرین همگام‌سازی: {tehranTimeLabel(new Date(sync.lastSyncedAt))}</p> : null}
          {sync.error ? <p className="error-text">{sync.error}</p> : null}
          {!localMode && sync.status !== 'synced' ? (
            <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={sync.retry}>تلاش دوباره</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function Layout({ section, children, email, onSignOut, onNavigate }: {
  section: SectionKey
  children: ReactNode
  email?: string
  onSignOut?: () => void
  onNavigate: (section: SectionKey) => void
}) {
  const { state, today } = useStore()
  const active = NAV.find(item => item.key === section) ?? NAV[0]
  const todayHours = state.studyDays.find(day => day.date === today)?.hours ?? 0
  const pendingReviews = state.reviews.filter(review => review.status !== 'completed' && review.dueDate <= today).length
  const initials = (email || 'م').slice(0, 1).toUpperCase()

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="ناوبری اصلی">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">م</div>
          <div>
            <strong>مرور</strong>
            <span>Moroor V2</span>
          </div>
        </div>

        <nav className="side-nav">
          {NAV.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                className={cx('side-link', section === item.key && 'side-link-active')}
                aria-current={section === item.key ? 'page' : undefined}
                onClick={() => onNavigate(item.key)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="side-card">
          <div className="side-card-head">
            <span>امروز</span>
            <Badge tone="info">{formatJalali(today, 'dayMonth')}</Badge>
          </div>
          <strong>{formatHours(todayHours)}</strong>
          <div className="side-card-foot">
            <span>{faNumber(pendingReviews, 0)} مرور در انتظار</span>
            <span>{faNumber(state.tasks.filter(task => task.status === 'open').length, 0)} کار باز</span>
          </div>
        </div>

        <div className="side-footer">
          <SyncIndicator />
          {email ? (
            <div className="account-row">
              <span className="avatar" aria-hidden="true">{initials}</span>
              <span className="account-email" title={email}>{email}</span>
              {onSignOut ? (
                <IconButton label="خروج از حساب" onClick={onSignOut}><LogOut size={16} /></IconButton>
              ) : null}
            </div>
          ) : (
            <div className="account-row">
              <span className="avatar" aria-hidden="true"><UserRound size={15} /></span>
              <span className="account-email">کاربر محلی</span>
            </div>
          )}
        </div>
      </aside>

      <div className="mobile-topbar">
        <div className="brand brand-small">
          <div className="brand-mark" aria-hidden="true">م</div>
          <div><strong>مرور</strong><span>{active.label}</span></div>
        </div>
        <SyncIndicator />
      </div>

      <main className="app-main" id="main-content">
        {children}
      </main>

      <nav className="bottom-nav" aria-label="ناوبری موبایل">
        {NAV.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              className={cx('bottom-link', section === item.key && 'bottom-link-active')}
              aria-current={section === item.key ? 'page' : undefined}
              onClick={() => onNavigate(item.key)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

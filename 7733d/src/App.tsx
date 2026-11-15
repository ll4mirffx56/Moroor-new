import { useEffect } from 'react'
import { CloudOff } from 'lucide-react'
import { AppStoreProvider, useStore } from './store/AppStore.js'
import { useAuth } from './store/useAuth.js'
import { useRoute, type SectionKey } from './store/useRoute.js'
import { Layout } from './components/Layout.js'
import { LoadingState, Toasts } from './components/ui.js'
import { AuthPage } from './pages/AuthPage.js'
import { DashboardPage } from './pages/Dashboard.js'
import { PlannerPage } from './pages/planner/PlannerPage.js'
import { PerformancePage } from './pages/performance/PerformancePage.js'
import { CoursesPage } from './pages/CoursesPage.js'
import { ReportsPage } from './pages/ReportsPage.js'
import { NotesSettingsPage } from './pages/NotesSettingsPage.js'

function Splash() {
  return (
    <div className="splash">
      <div className="brand brand-auth">
        <div className="brand-mark" aria-hidden="true">م</div>
        <div><strong>مرور</strong><span>Moroor V2</span></div>
      </div>
      <LoadingState label="در حال بررسی نشست کاربری…" />
    </div>
  )
}

function LocalModeBanner({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { localMode } = useStore()
  if (!localMode) return null
  return (
    <div className="local-banner" role="status">
      <CloudOff size={16} aria-hidden="true" />
      <span>حالت محلی: اطلاعات فقط در همین مرورگر ذخیره می‌شود و بین دستگاه‌ها همگام نمی‌شود.</span>
      <button type="button" className="link-button" onClick={onOpenAccount}>تنظیم حساب و همگام‌سازی</button>
    </div>
  )
}

function AppContent({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const { route, navigate } = useRoute()
  const { toasts, dismissToast, localMode } = useStore()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [route.section, route.tab])

  const onSection = (section: SectionKey) => navigate(section)

  return (
    <Layout section={route.section} onNavigate={onSection} email={email} onSignOut={onSignOut}>
      <LocalModeBanner onOpenAccount={() => navigate('notes', 'account')} />
      {route.section === 'dashboard' ? <DashboardPage onNavigate={navigate} /> : null}
      {route.section === 'planner' ? (
        <PlannerPage tab={route.tab} onTab={tab => navigate('planner', tab)} />
      ) : null}
      {route.section === 'performance' ? (
        <PerformancePage tab={route.tab} onTab={tab => navigate('performance', tab)} />
      ) : null}
      {route.section === 'courses' ? <CoursesPage /> : null}
      {route.section === 'reports' ? (
        <ReportsPage tab={route.tab} onTab={tab => navigate('reports', tab)} />
      ) : null}
      {route.section === 'notes' ? (
        <NotesSettingsPage
          tab={route.tab}
          onTab={tab => navigate('notes', tab)}
          email={email}
          onSignOut={onSignOut}
          localMode={localMode}
        />
      ) : null}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </Layout>
  )
}

export default function App() {
  const auth = useAuth()

  if (!auth.configured) {
    return (
      <AppStoreProvider userId={null}>
        <AppContent email="" onSignOut={() => undefined} />
      </AppStoreProvider>
    )
  }

  if (!auth.ready) return <Splash />

  if (!auth.user) {
    return <AuthPage auth={auth} />
  }

  return (
    <AppStoreProvider userId={auth.user.id}>
      <AppContent email={auth.email} onSignOut={() => { void auth.signOut() }} />
    </AppStoreProvider>
  )
}

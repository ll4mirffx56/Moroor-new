import { useCallback, useEffect, useState } from 'react'

export const SECTIONS = ['dashboard', 'planner', 'performance', 'courses', 'reports', 'notes'] as const
export type SectionKey = typeof SECTIONS[number]

export type Route = { section: SectionKey; tab: string }

const DEFAULT_TABS: Record<SectionKey, string> = {
  dashboard: '',
  planner: 'reviews',
  performance: 'daily',
  courses: '',
  reports: 'weekly',
  notes: 'list',
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [rawSection, rawTab] = clean.split('/')
  const section = (SECTIONS as readonly string[]).includes(rawSection) ? rawSection as SectionKey : 'dashboard'
  return { section, tab: rawTab || DEFAULT_TABS[section] }
}

export function routeHash(section: SectionKey, tab?: string): string {
  return tab ? `#/${section}/${tab}` : `#/${section}`
}

export function useRoute(): {
  route: Route
  navigate: (section: SectionKey, tab?: string) => void
} {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', routeHash('dashboard'))
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((section: SectionKey, tab?: string) => {
    const next = routeHash(section, tab ?? (DEFAULT_TABS[section] || undefined))
    window.location.hash = next
    setRoute(parse(next))
  }, [])

  return { route, navigate }
}

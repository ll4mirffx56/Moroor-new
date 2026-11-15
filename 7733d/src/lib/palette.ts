import type { PaletteKey } from './model.js'

export const PALETTE_CSS: Record<PaletteKey, string> = {
  blue: 'var(--c-blue)',
  violet: 'var(--c-violet)',
  green: 'var(--c-green)',
  amber: 'var(--c-amber)',
  rose: 'var(--c-rose)',
  cyan: 'var(--c-cyan)',
  teal: 'var(--c-teal)',
  orange: 'var(--c-orange)',
  indigo: 'var(--c-indigo)',
  pink: 'var(--c-pink)',
}

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  blue: 'آبی',
  violet: 'بنفش',
  green: 'سبز',
  amber: 'کهربایی',
  rose: 'گلبهی',
  cyan: 'فیروزه‌ای',
  teal: 'سبزآبی',
  orange: 'نارنجی',
  indigo: 'نیلی',
  pink: 'صورتی',
}

export const PALETTE_KEYS = Object.keys(PALETTE_CSS) as PaletteKey[]

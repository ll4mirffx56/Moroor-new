import {
  Atom, Binary, BookOpen, FlaskConical, Globe, Languages, Moon, Percent, Shapes, Sigma, type LucideIcon,
} from 'lucide-react'
import type { SubjectIconKey } from '../lib/model.js'

const GLYPHS: Record<SubjectIconKey, LucideIcon> = {
  atom: Atom,
  flask: FlaskConical,
  sigma: Sigma,
  shapes: Shapes,
  binary: Binary,
  percent: Percent,
  book: BookOpen,
  languages: Languages,
  moon: Moon,
  globe: Globe,
}

export function SubjectGlyph({ icon, size = 18, className }: { icon: SubjectIconKey; size?: number; className?: string }) {
  const Glyph = GLYPHS[icon] ?? BookOpen
  return <Glyph size={size} className={className} aria-hidden="true" />
}

export const ICON_OPTIONS: { value: SubjectIconKey; label: string }[] = [
  { value: 'atom', label: 'اتم' },
  { value: 'flask', label: 'آزمایشگاه' },
  { value: 'sigma', label: 'ریاضی' },
  { value: 'shapes', label: 'هندسه' },
  { value: 'binary', label: 'گسسته' },
  { value: 'percent', label: 'آمار' },
  { value: 'book', label: 'کتاب' },
  { value: 'languages', label: 'زبان' },
  { value: 'moon', label: 'دینی' },
  { value: 'globe', label: 'جهانی' },
]

import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import {
  PERSIAN_MONTHS, PERSIAN_WEEKDAYS_SHORT, faNumber, faYear, formatJalali, isoToJalaliParts,
  jalaliMonthMatrix, shiftJalaliMonth, todayISOInTehran,
} from '../lib/date.js'
import { cx, Field, IconButton } from './ui.js'

export type DateEvents = Record<string, number>

function monthLabel(jy: number, jm: number): string {
  return `${PERSIAN_MONTHS[jm - 1]} ${faYear(jy)}`
}

export function JalaliCalendar({ value, onChange, today, events, compact }: {
  value: string
  onChange: (iso: string) => void
  today?: string
  events?: DateEvents
  compact?: boolean
}) {
  const current = isoToJalaliParts(value) ?? isoToJalaliParts(today ?? todayISOInTehran())
  const [cursor, setCursor] = useState({ jy: current?.jy ?? 1400, jm: current?.jm ?? 1 })
  const todayIso = today ?? todayISOInTehran()
  const todayParts = isoToJalaliParts(todayIso)

  useEffect(() => {
    const parts = isoToJalaliParts(value)
    if (parts) setCursor({ jy: parts.jy, jm: parts.jm })
  }, [value])

  const cells = jalaliMonthMatrix(cursor.jy, cursor.jm)
  const move = (delta: number) => setCursor(state => shiftJalaliMonth(state.jy, state.jm, delta))
  const goToday = () => {
    if (todayParts) setCursor({ jy: todayParts.jy, jm: todayParts.jm })
    onChange(todayIso)
  }

  return (
    <div className={cx('calendar', compact && 'calendar-compact')}>
      <div className="calendar-head">
        <div className="calendar-nav">
          <IconButton label="سال قبل" onClick={() => move(-12)}><ChevronsRight size={16} /></IconButton>
          <IconButton label="ماه قبل" onClick={() => move(-1)}><ChevronRight size={16} /></IconButton>
        </div>
        <strong aria-live="polite">{monthLabel(cursor.jy, cursor.jm)}</strong>
        <div className="calendar-nav">
          <IconButton label="ماه بعد" onClick={() => move(1)}><ChevronLeft size={16} /></IconButton>
          <IconButton label="سال بعد" onClick={() => move(12)}><ChevronsLeft size={16} /></IconButton>
        </div>
      </div>
      <div className="calendar-grid">
        {PERSIAN_WEEKDAYS_SHORT.map(label => <span key={label} className="calendar-weekday">{label}</span>)}
        {cells.map(cell => {
          const count = events?.[cell.iso] ?? 0
          const isSelected = Boolean(value) && cell.iso === value
          const isToday = cell.iso === todayIso
          return (
            <button
              key={cell.iso}
              type="button"
              className={cx(
                'calendar-day',
                !cell.inMonth && 'calendar-day-muted',
                isSelected && 'calendar-day-selected',
                isToday && 'calendar-day-today',
              )}
              aria-pressed={isSelected}
              aria-label={formatJalali(cell.iso, 'full')}
              onClick={() => onChange(cell.iso)}
            >
              <span>{faNumber(cell.jd, 0)}</span>
              {count > 0 ? <i className="calendar-dot" aria-hidden="true">{count > 3 ? '۳+' : faNumber(count, 0)}</i> : null}
            </button>
          )
        })}
      </div>
      <div className="calendar-foot">
        <button type="button" className="link-button" onClick={goToday}>امروز</button>
        <span className="muted">{value ? formatJalali(value, 'full') : 'تاریخی انتخاب نشده'}</span>
      </div>
    </div>
  )
}

export function DateField({ label, value, onChange, hint, error, required, events, today, disabled, id }: {
  label: string
  value: string
  onChange: (iso: string) => void
  hint?: string
  error?: string
  required?: boolean
  events?: DateEvents
  today?: string
  disabled?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const fieldId = id ?? generatedId

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId}>
      <div className="date-field" ref={containerRef}>
        <button
          id={fieldId}
          type="button"
          className={cx('ui-input date-trigger', error && 'input-invalid')}
          onClick={() => setOpen(state => !state)}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
        >
          <CalendarDays size={17} aria-hidden="true" />
          <span>{value ? formatJalali(value, 'full') : 'انتخاب تاریخ'}</span>
          <span className="date-trigger-hint">تقویم شمسی</span>
        </button>
        {open ? (
          <div className="calendar-popup" role="dialog" aria-label={label}>
            <JalaliCalendar
              value={value}
              today={today}
              events={events}
              onChange={iso => { onChange(iso); setOpen(false) }}
            />
          </div>
        ) : null}
      </div>
    </Field>
  )
}

/** Compact inline date switcher used in dashboards and reports. */
export function DateStepper({ value, onChange, today }: { value: string; onChange: (iso: string) => void; today: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])
  return (
    <div className="date-stepper" ref={ref}>
      <button type="button" className="date-stepper-trigger" onClick={() => setOpen(state => !state)} aria-expanded={open}>
        <CalendarDays size={16} aria-hidden="true" />
        <span>{formatJalali(value, 'long')}</span>
      </button>
      {open ? (
        <div className="calendar-popup calendar-popup-inline">
          <JalaliCalendar value={value} today={today} onChange={iso => { onChange(iso); setOpen(false) }} />
        </div>
      ) : null}
    </div>
  )
}

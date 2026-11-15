import { useEffect, useRef, useState, type ReactNode } from 'react'
import { faNumber, formatPercent } from '../lib/date.js'
import { cx } from './ui.js'

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(Math.max(240, element.clientWidth))
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

export type LinePoint = { label: string; value: number | null; meta?: string }

export function LineChart({ points, height = 230, suffix = '٪', emptyLabel = 'داده‌ای برای نمایش نیست', onSelect }: {
  points: LinePoint[]
  height?: number
  suffix?: string
  emptyLabel?: string
  onSelect?: (point: LinePoint, index: number) => void
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const usable = points.filter(point => point.value !== null)
  if (usable.length === 0) {
    return <div ref={ref} className="chart-empty">{emptyLabel}</div>
  }
  const padX = 46
  const padTop = 18
  const padBottom = 30
  const plotW = Math.max(80, width - padX - 16)
  const plotH = Math.max(60, height - padTop - padBottom)
  const values = points.map(point => point.value).filter((value): value is number => value !== null && Number.isFinite(value))
  const rawMax = Math.max(1, ...values)
  const rawMin = Math.min(0, ...values)
  const max = rawMax + Math.max(1, rawMax * 0.12)
  const min = rawMin - (rawMin < 0 ? Math.abs(rawMin) * 0.12 : 0)
  const scaleY = (value: number) => padTop + plotH - ((value - min) / (max - min || 1)) * plotH
  const scaleX = (index: number) => padX + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW)

  const segments: Array<Array<{ x: number; y: number; index: number }>> = []
  let current: Array<{ x: number; y: number; index: number }> = []
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) segments.push(current)
      current = []
      return
    }
    current.push({ x: scaleX(index), y: scaleY(point.value), index })
  })
  if (current.length) segments.push(current)

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(ratio => min + (max - min) * ratio)
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 70))))
  const activePoint = active !== null ? points[active] : null

  return (
    <div ref={ref} className="line-chart">
      <svg width={width} height={height} role="img" aria-label="نمودار روند">
        {ticks.map((tick, index) => {
          const y = scaleY(tick)
          return (
            <g key={index}>
              <line x1={padX} x2={width - 8} y1={y} y2={y} className="chart-grid" />
              <text x={padX - 8} y={y + 4} textAnchor="end" className="chart-axis-text">{faNumber(tick, 0)}</text>
            </g>
          )
        })}
        {segments.map((segment, segmentIndex) => {
          const line = segment.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
          const first = segment[0]
          const last = segment[segment.length - 1]
          const area = `${line} L ${last.x} ${padTop + plotH} L ${first.x} ${padTop + plotH} Z`
          return (
            <g key={segmentIndex}>
              <path d={area} className="chart-area" />
              <path d={line} className="chart-line" />
            </g>
          )
        })}
        {points.map((point, index) => {
          if (point.value === null) return null
          const x = scaleX(index)
          const y = scaleY(point.value)
          return (
            <g key={`${point.label}-${index}`} className="chart-point-group">
              <circle cx={x} cy={y} r={active === index ? 5.5 : 3.5} className={cx('chart-point', active === index && 'chart-point-active')} />
              <circle
                cx={x}
                cy={y}
                r={13}
                className="chart-hit"
                tabIndex={0}
                role={onSelect ? 'button' : undefined}
                aria-label={`${point.label}: ${formatPercent(point.value)}`}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                onClick={() => onSelect?.(point, index)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(point, index) } }}
              />
            </g>
          )
        })}
        {points.map((point, index) => (
          index % labelEvery === 0 || index === points.length - 1 ? (
            <text key={`label-${index}`} x={scaleX(index)} y={height - 8} textAnchor="middle" className="chart-axis-text">
              {point.label}
            </text>
          ) : null
        ))}
      </svg>
      <div className="chart-active" aria-live="polite">
        {activePoint
          ? <span>{activePoint.label}: <strong>{activePoint.value === null ? '—' : `${faNumber(activePoint.value, 1)}${suffix}`}</strong>{activePoint.meta ? ` · ${activePoint.meta}` : ''}</span>
          : <span className="muted">برای دیدن مقدار هر نقطه، روی آن نگه دار</span>}
      </div>
    </div>
  )
}

export type BarItem = {
  key: string
  label: string
  value: number | null
  color?: string
  hint?: string
}

export function BarChart({ items, max = 100, suffix = '٪', onSelect, emptyLabel = 'داده‌ای ثبت نشده است', labelWidth = 104 }: {
  items: BarItem[]
  max?: number
  suffix?: string
  onSelect?: (item: BarItem) => void
  emptyLabel?: string
  labelWidth?: number
}) {
  if (!items.length) return <div className="chart-empty">{emptyLabel}</div>
  const scale = Math.max(1, max)
  return (
    <div className="bar-chart">
      {items.map(item => {
        const width = item.value === null ? 0 : Math.max(2, Math.min(100, (item.value / scale) * 100))
        const content = (
          <>
            <span className="bar-label" style={{ width: labelWidth }}>{item.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${width}%`, background: item.color ?? 'var(--accent)' }} />
            </span>
            <span className="bar-value">{item.value === null ? '—' : `${faNumber(item.value, 1)}${suffix}`}</span>
          </>
        )
        return onSelect
          ? (
              <button key={item.key} type="button" className="bar-row bar-clickable" onClick={() => onSelect(item)} title={item.hint}>
                {content}
              </button>
            )
          : <div key={item.key} className="bar-row" title={item.hint}>{content}</div>
      })}
    </div>
  )
}

export function MiniBars({ items, height = 64 }: { items: { label: string; value: number; color?: string }[]; height?: number }) {
  const max = Math.max(1, ...items.map(item => item.value))
  return (
    <div className="mini-bars" style={{ height }}>
      {items.map((item, index) => (
        <div key={index} className="mini-bar" title={`${item.label}: ${faNumber(item.value, 1)}`}>
          <span style={{ height: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color ?? 'var(--accent)' }} />
        </div>
      ))}
    </div>
  )
}

export function Sparkline({ values, width = 110, height = 34 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="muted">—</span>
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 4) + 2
    const y = height - 2 - ((value - min) / (max - min || 1)) * (height - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  )
}

export type HeatmapDay = {
  date: string
  level: 0 | 1 | 2 | 3 | 4
  hours: number
  tests: number
  reviewsCompleted: number
  tasksCompleted: number
  exams: number
  percent: number | null
  score: number
}

export function ActivityHeatmap({ weeks, onSelect, monthLabels, weekdayLabels, legend = 'کمتر → بیشتر' }: {
  weeks: { days: HeatmapDay[] }[]
  onSelect?: (day: HeatmapDay) => void
  monthLabels: string[]
  weekdayLabels: string[]
  legend?: string
}) {
  return (
    <div className="heatmap">
      <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${Math.max(1, weeks.length)}, minmax(0, 1fr))` }} aria-hidden="true">
        {monthLabels.map((label, index) => <span key={index}>{label}</span>)}
      </div>
      <div className="heatmap-body">
        <div className="heatmap-weekdays" aria-hidden="true">
          {weekdayLabels.map((label, index) => <span key={index}>{label}</span>)}
        </div>
        <div className="heatmap-weeks" style={{ gridTemplateColumns: `repeat(${Math.max(1, weeks.length)}, minmax(0, 1fr))` }}>
          {weeks.map((week, weekIndex) => (
            <div className="heatmap-week" key={weekIndex}>
              {week.days.map(day => (
                <button
                  key={day.date}
                  type="button"
                  className={cx('heat-cell', `heat-${day.level}`)}
                  onClick={() => onSelect?.(day)}
                  aria-label={`${day.date}، فعالیت سطح ${day.level}`}
                  title={`${day.hours.toFixed(1)} ساعت · ${day.tests} تست · ${day.reviewsCompleted} مرور`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>{legend}</span>
        {[0, 1, 2, 3, 4].map(level => <span key={level} className={cx('heat-cell', `heat-${level}`)} />)}
      </div>
    </div>
  )
}

export function ProgressRing({ value, size = 74, label, tone = 'var(--accent)' }: {
  value: number
  size?: number
  label?: ReactNode
  tone?: string
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`پیشرفت ${safe.toFixed(0)} درصد`}>
        <circle cx={size / 2} cy={size / 2} r={radius} className="ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="ring-value"
          stroke={tone}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (safe / 100) * circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-label">{label ?? `${faNumber(safe, 0)}٪`}</span>
    </div>
  )
}

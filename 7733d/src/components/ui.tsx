import {
  useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, X } from 'lucide-react'
import type { Toast, ToastTone } from '../store/AppStore.js'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md'

export function Button({
  variant = 'primary', size = 'md', icon, full, className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  full?: boolean
}) {
  return (
    <button
      type={props.type ?? 'button'}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, full && 'btn-full', className)}
      {...props}
    >
      {icon ? <span className="btn-icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </button>
  )
}

export function IconButton({
  label, className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('icon-btn', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({
  title, subtitle, action, children, className, dense, id,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  dense?: boolean
  id?: string
}) {
  return (
    <section id={id} className={cx('card', dense && 'card-dense', className)}>
      {(title || action) ? (
        <header className="card-head">
          <div>
            {title ? <h2 className="card-title">{title}</h2> : null}
            {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="card-action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function PageHeader({ title, description, actions, eyebrow }: {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

type BadgeTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info' | 'violet'

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cx('badge', `badge-${tone}`, className)}>{children}</span>
}

export function ProgressBar({ value, tone = 'accent', label, compact }: {
  value: number
  tone?: 'accent' | 'positive' | 'warning' | 'danger' | 'violet'
  label?: string
  compact?: boolean
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div className={cx('progress', compact && 'progress-compact')}>
      {label ? (
        <div className="progress-label">
          <span>{label}</span>
          <span>{safe.toFixed(0)}٪</span>
        </div>
      ) : null}
      <div
        className={cx('progress-track', `progress-${tone}`)}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safe)}
        aria-label={label ?? 'پیشرفت'}
      >
        <span style={{ width: `${safe}%` }} />
      </div>
    </div>
  )
}

export function Field({ label, hint, error, htmlFor, children, required }: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <div className={cx('field', error && 'field-error')}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="required" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? <p className="field-message field-error-text" role="alert">{error}</p> : hint ? <p className="field-message">{hint}</p> : null}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('ui-input', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('ui-input ui-textarea', className)} {...props} />
}

export function Select({
  options, className, ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string; disabled?: boolean }[] }) {
  return (
    <select className={cx('ui-input ui-select', className)} {...props}>
      {options.map(option => (
        <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
      ))}
    </select>
  )
}

export function Switch({ checked, onChange, label, hint }: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  const id = useId()
  return (
    <div className="switch-row">
      <div>
        <label htmlFor={id} className="switch-label">{label}</label>
        {hint ? <p className="field-message">{hint}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={cx('switch', checked && 'switch-on')}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, ariaLabel }: {
  tabs: readonly { key: T; label: string; icon?: ReactNode; count?: number }[]
  value: T
  onChange: (key: T) => void
  ariaLabel: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          className={cx('tab', value === tab.key && 'tab-active')}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon ? <span aria-hidden="true">{tab.icon}</span> : null}
          <span>{tab.label}</span>
          {typeof tab.count === 'number' ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cx('segment', value === option.value && 'segment-active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button')
      focusable?.focus()
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      window.clearTimeout(timer)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('modal', `modal-${size}`)}>
        <header className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <IconButton label="بستن" onClick={onClose}><X size={18} /></IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'حذف', cancelLabel = 'انصراف', tone = 'danger', onConfirm, onCancel, busy }: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null}
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <div className="confirm-body">{message}</div>
    </Modal>
  )
}

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon" aria-hidden="true">{icon}</div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}

export function LoadingState({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <Loader2 className="spin" size={22} />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={22} />
      <div>
        <h3>خطا در بارگذاری اطلاعات</h3>
        <p>{message}</p>
        {onRetry ? (
          <Button size="sm" variant="secondary" icon={<RefreshCw size={15} />} onClick={onRetry}>تلاش دوباره</Button>
        ) : null}
      </div>
    </div>
  )
}

export function Callout({ tone = 'info', title, children }: {
  tone?: 'info' | 'positive' | 'warning' | 'danger'
  title?: string
  children: ReactNode
}) {
  return (
    <div className={cx('callout', `callout-${tone}`)}>
      <div className="callout-icon" aria-hidden="true">
        {tone === 'positive' ? <CheckCircle2 size={18} /> : tone === 'warning' || tone === 'danger' ? <AlertTriangle size={18} /> : <Info size={18} />}
      </div>
      <div>
        {title ? <strong>{title}</strong> : null}
        <div className="callout-body">{children}</div>
      </div>
    </div>
  )
}

const TOAST_ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <AlertTriangle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={cx('toast', `toast-${toast.tone}`)}>
          <span className="toast-icon" aria-hidden="true">{TOAST_ICONS[toast.tone]}</span>
          <div className="toast-body">
            <p>{toast.message}</p>
            {toast.details?.length ? (
              <ul>
                {toast.details.slice(0, 5).map((detail, index) => <li key={index}>{detail}</li>)}
              </ul>
            ) : null}
          </div>
          <IconButton label="بستن پیام" onClick={() => onDismiss(toast.id)}><X size={15} /></IconButton>
        </div>
      ))}
    </div>
  )
}

export function StatTile({ label, value, hint, tone = 'neutral', icon }: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'accent'
  icon?: ReactNode
}) {
  return (
    <div className={cx('stat-tile', `stat-${tone}`)}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon ? <span className="stat-icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  )
}

export function Divider() {
  return <div className="divider" role="presentation" />
}

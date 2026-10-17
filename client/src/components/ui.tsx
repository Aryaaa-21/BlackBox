import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Check, CircleAlert, CircleDashed, CloudOff, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { cn } from '../lib/cn'
export { MotionBlurText } from './ui/motion-blur-text'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet'

export function Button({
  children,
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button className={cn('button', `button--${variant}`, className)} {...props}>
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={cn('icon-button', className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('card', className)}>{children}</section>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={cn('badge', `badge--${tone}`)}>{children}</span>
}

export function Field({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cn('field', className)}>
      <span className="field__label">{label}</span>
      <input className="field__input" {...props} />
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function TextareaField({
  label,
  hint,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className={cn('field', className)}>
      <span className="field__label">{label}</span>
      <textarea className="field__input field__textarea" {...props} />
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function SelectField({
  label,
  hint,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <label className={cn('field', className)}>
      <span className="field__label">{label}</span>
      <select className="field__input field__select" {...props}>{children}</select>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-heading__action">{action}</div> : null}
    </div>
  )
}

export type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'unknown'
export type SyncState = 'synced' | 'pending' | 'syncing' | 'conflict' | 'failed' | 'idle'

const connectionCopy: Record<ConnectionState, string> = {
  online: 'Online',
  offline: 'Offline',
  reconnecting: 'Reconnecting',
  unknown: 'Connection pending',
}

export function NetworkIndicator({ state = 'unknown' }: { state?: ConnectionState }) {
  return (
    <span className={cn('indicator', `indicator--${state}`)}>
      <span className="indicator__dot" aria-hidden="true" />
      <span>{connectionCopy[state]}</span>
    </span>
  )
}

const syncCopy: Record<SyncState, string> = {
  synced: 'Synced',
  pending: 'Pending sync',
  syncing: 'Syncing',
  conflict: 'Conflict',
  failed: 'Sync failed',
  idle: 'Sync not connected',
}

export function SyncIndicator({ state = 'idle' }: { state?: SyncState }) {
  const Icon = state === 'synced' ? Check : state === 'conflict' || state === 'failed' ? CircleAlert : state === 'idle' ? CircleDashed : state === 'pending' ? CloudOff : state === 'syncing' ? RefreshCw : LoaderCircle
  return (
    <span className={cn('sync-indicator', `sync-indicator--${state}`)}>
      <Icon size={14} aria-hidden="true" className={state === 'syncing' ? 'spin' : undefined} />
      <span>{syncCopy[state]}</span>
    </span>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}

export function LoadingState({ label = 'Loading data' }: { label?: string }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" size={18} /><span>{label}</span></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-state" role="alert"><CircleAlert size={18} /><span>{message}</span>{onRetry ? <Button variant="ghost" onClick={onRetry}>Try again</Button> : null}</div>
}

export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal__header"><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={17} /></IconButton></div>
      <div className="modal__body">{children}</div>
      {footer ? <div className="modal__footer">{footer}</div> : null}
    </section>
  </div>
}

export function Drawer({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="modal__header"><h2 id="drawer-title">{title}</h2><IconButton label="Close drawer" onClick={onClose}><X size={17} /></IconButton></div>
      <div className="drawer__body">{children}</div>
      {footer ? <div className="modal__footer">{footer}</div> : null}
    </aside>
  </div>
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={`status-${status.toLowerCase()}`}>{status.replaceAll('_', ' ')}</Badge>
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={`priority-${priority.toLowerCase()}`}>{priority}</Badge>
}

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return <div className="table-wrap"><table style={{ minWidth }}>{children}</table></div>
}

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string
  title: string
  description: string
  icon: ReactNode
}) {
  return (
    <>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <Card className="placeholder-card">
        <EmptyState title="Ready for integration" description="This workspace is intentionally empty until the connected data layer is added." icon={icon} />
      </Card>
    </>
  )
}

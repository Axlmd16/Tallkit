import {
  CheckCircle,
  Info,
  SpinnerGap,
  Storefront,
  WarningCircle,
  Wrench,
  XCircle,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  info: 'bg-info-soft text-primary-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

const toneIcons = {
  neutral: Info,
  info: Info,
  success: CheckCircle,
  warning: WarningCircle,
  danger: XCircle,
} as const

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: Tone
}) {
  const Icon = toneIcons[tone]
  return (
    <span
      aria-label={`Estado: ${label}`}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${toneClasses[tone]}`}
      role="status"
    >
      <Icon aria-hidden="true" size={16} weight="regular" />
      {label}
    </span>
  )
}

export function FiscalScopeBadge({
  scope,
}: {
  scope: 'commercial' | 'artesanal'
}) {
  const commercial = scope === 'commercial'
  const Icon = commercial ? Storefront : Wrench
  return (
    <span
      aria-label={`Ámbito fiscal: ${commercial ? 'RUC comercial' : 'RUC artesanal'}`}
      className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold ${commercial ? 'bg-primary-soft text-primary-strong' : 'bg-warning-soft text-warning'}`}
      role="status"
    >
      <Icon aria-hidden="true" size={18} weight="regular" />
      {commercial ? 'RUC comercial' : 'RUC artesanal'}
    </span>
  )
}

export function InlineNotice({
  children,
  title,
  tone = 'info',
}: {
  children?: ReactNode
  title: string
  tone?: Exclude<Tone, 'neutral'>
}) {
  const Icon = toneIcons[tone]
  return (
    <div
      className={`flex gap-3 rounded-group p-4 ${toneClasses[tone]}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
      <div>
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm">{children}</div>}
      </div>
    </div>
  )
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-28 items-center justify-center gap-3 text-ink-muted"
      role="status"
    >
      <SpinnerGap aria-hidden="true" className="animate-spin" size={22} />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode
  description: string
  title: string
}) {
  return (
    <section className="rounded-group bg-surface px-5 py-10 text-center shadow-card">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-ink-muted">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  )
}

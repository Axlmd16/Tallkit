import {
  CheckCircle,
  Info,
  LockSimple,
  SpinnerGap,
  Tag,
  WarningCircle,
  Wrench,
  XCircle,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'

import { useBusinessName } from '@/shared/api/entity-logos'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const toneClasses: Record<Tone, string> = {
  /** Estados neutros («Solicitada», «Finalizado»): grafito sobre gris cálido, sin color propio. */
  neutral: 'bg-info-soft text-info',
  info: 'bg-info-soft text-info',
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

export type StatusBadgeShape = 'pill' | 'rectangle'
export type StatusBadgeKind = 'status' | 'category'

export interface StatusBadgeProps {
  label: string
  tone?: Tone
  shape?: StatusBadgeShape
  kind?: StatusBadgeKind
  showIcon?: boolean
  className?: string
}

export function StatusBadge({
  label,
  tone = 'neutral',
  shape = 'pill',
  kind = 'status',
  showIcon = kind === 'status',
  className = '',
}: StatusBadgeProps) {
  const shapeClass = shape === 'rectangle' ? 'rounded-chip' : 'rounded-full'
  const isStatus = kind === 'status'

  return (
    <span
      aria-label={isStatus ? `Estado: ${label}` : `Categoría: ${label}`}
      className={`inline-flex min-h-[22px] items-center gap-1.5 ${shapeClass} px-2 py-0.5 text-label font-semibold whitespace-nowrap ${toneClasses[tone]} ${className}`}
      {...(isStatus ? { role: 'status' } : {})}
    >
      {showIcon && (
        <span
          aria-hidden="true"
          className="inline-block size-[7px] shrink-0 rounded-full bg-current"
          data-marker=""
        />
      )}
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
  const Icon = commercial ? Tag : Wrench
  const name = useBusinessName(scope)
  return (
    <span
      aria-label={`Negocio: ${name}`}
      className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label font-semibold whitespace-nowrap ${commercial ? 'bg-scope-commercial-soft text-scope-commercial-ink' : 'bg-scope-artisan-soft text-scope-artisan-ink'}`}
      role="status"
    >
      <Icon aria-hidden="true" size={14} weight="bold" />
      {name}
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
      className={`flex gap-2.5 rounded-control px-3 py-2.5 text-body ${toneClasses[tone]}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-label">{children}</div>}
      </div>
    </div>
  )
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-24 items-center justify-center gap-2.5 text-body text-ink-muted"
      role="status"
    >
      <SpinnerGap
        aria-hidden="true"
        className="animate-spin motion-reduce:animate-none"
        size={18}
      />
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
    <section className="rounded-panel border border-line bg-surface px-5 py-9 text-center">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-body text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </section>
  )
}

/** Estado «sin permiso»: explica qué rol concede el acceso; la denegación real es del backend. */
export function ForbiddenState({
  action,
  description,
  title,
}: {
  action?: ReactNode
  description: string
  title: string
}) {
  return (
    <section className="rounded-panel border border-line bg-surface px-5 py-9 text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid size-11 place-items-center rounded-panel bg-surface-muted text-ink-muted"
      >
        <LockSimple size={22} />
      </span>
      <h2 className="mt-3 text-body font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-body text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </section>
  )
}

/** Marcadores de carga en filas: ocupan el lugar de la tabla sin mostrar datos. */
export function SkeletonRows({
  label = 'Cargando…',
  rows = 5,
}: {
  label?: string
  rows?: number
}) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          aria-hidden="true"
          className="grid h-11 grid-cols-[5.5rem_minmax(0,1fr)_5rem_4rem] items-center gap-4 border-b border-line px-4 last:border-b-0"
          data-skeleton-row=""
          key={index}
        >
          <span className="h-2.5 w-16 rounded-chip bg-surface-muted" />
          <span
            className="h-2.5 rounded-chip bg-surface-muted"
            style={{ width: `${48 + ((index * 17) % 36)}%` }}
          />
          <span className="h-2.5 w-14 rounded-chip bg-surface-muted" />
          <span className="h-2.5 w-12 justify-self-end rounded-chip bg-surface-muted" />
        </div>
      ))}
    </div>
  )
}

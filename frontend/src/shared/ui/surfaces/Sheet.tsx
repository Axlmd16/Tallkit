import { Check } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

/** Encabezado de una sección dentro de la hoja de configuración. */
export function SheetHeading({
  title,
  description,
  actions,
  level = 2,
  id,
}: {
  id?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  level?: 2 | 3
}) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Heading
          id={id}
          className={`font-bold text-ink ${level === 2 ? 'text-block' : 'text-lead'}`}
        >
          {title}
        </Heading>
        {description && (
          <p
            className={`mt-1.5 max-w-[80ch] text-ink-muted ${level === 2 ? 'text-body' : 'text-body'}`}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex min-w-0 shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

/** Número de pendientes con marcador ámbar y texto accesible. */
export function PendingCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
      <span aria-hidden="true" className="size-[7px] rounded-full bg-warning" />
      {count}
      <span className="sr-only">
        {count === 1 ? ' pendiente' : ' pendientes'}
      </span>
    </span>
  )
}

export function SubsectionIndicator({
  label,
  tone,
  count,
}: {
  label: string
  tone: 'success' | 'warning' | 'neutral'
  /** Con pendientes, se muestra el número y el texto completo queda para lectores de pantalla. */
  count?: number | undefined
}) {
  if (tone === 'success')
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <Check aria-hidden="true" size={14} weight="bold" />
        <span className="sr-only">{label}</span>
      </span>
    )
  if (tone === 'warning')
    return count !== undefined ? (
      <PendingCount count={count} />
    ) : (
      <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
        <span
          aria-hidden="true"
          className="size-[7px] rounded-full bg-warning"
        />
        {label}
      </span>
    )
  return <span className="text-ink-muted">{label}</span>
}

/** Estado con marcador de forma y texto, sin depender del color. */
export function StateMark({
  label,
  tone,
}: {
  label: string
  tone: 'active' | 'inactive' | 'unknown' | 'success'
}) {
  const marker = {
    active: 'bg-accent',
    success: 'bg-success',
    inactive: 'bg-line-strong',
    unknown: 'border-[1.5px] border-ink-muted bg-transparent',
  }[tone]
  return (
    <span
      className={`inline-flex items-center gap-2 text-body ${tone === 'unknown' ? 'text-ink-muted' : 'text-ink'}`}
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${marker}`}
      />
      {label}
    </span>
  )
}

export const sheetTableHead =
  'bg-surface-subtle px-4 py-2.5 text-left text-label font-semibold text-ink-muted first:rounded-l-control first:pl-3 last:rounded-r-control last:pr-3 last:text-right'
export const sheetTableCell =
  'border-b border-line px-4 py-3 align-middle first:pl-3 last:pr-3 last:text-right'

export type StateChipTone =
  | 'success'
  | 'warning'
  | 'info'
  | 'primary'
  | 'neutral'
  | 'danger'

const chipTones: Record<StateChipTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  primary: 'bg-primary-soft text-primary',
  neutral: 'bg-surface-muted text-ink-muted',
  danger: 'bg-danger-soft text-danger',
}

/** Estado en chip suave de la paleta Tallkit: marcador de forma y texto, no solo color. */
export function StateChip({
  label,
  tone,
}: {
  label: string
  tone: StateChipTone
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-label font-semibold whitespace-nowrap ${chipTones[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`size-[7px] shrink-0 bg-current ${tone === 'warning' || tone === 'neutral' ? 'rounded-chip' : 'rounded-full'}`}
      />
      {label}
    </span>
  )
}

import type { ReactNode } from 'react'

export function FieldHelp({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  return (
    <span className="mt-1 block text-xs font-normal text-ink-muted" id={id}>
      {children}
    </span>
  )
}

export function SubsectionHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="font-bold text-ink">{title}</h3>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No se pudo guardar el cambio.'
}

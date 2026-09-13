import type { HTMLAttributes, Key, ReactNode } from 'react'

import { Button, ButtonGroup } from './controls'

export function PageHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode
  description?: string
  title: string
}) {
  return (
    <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl leading-[33px] font-bold text-ink">{title}</h1>
        {description && (
          <p className="mt-1 max-w-[72ch] text-sm text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}

export function Toolbar({
  children,
  label,
  className = '',
}: {
  children: ReactNode
  label: string
  className?: string
}) {
  return (
    <div
      aria-label={label}
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="toolbar"
    >
      {children}
    </div>
  )
}

export function FilterPanel({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div aria-label={label} className="filter-panel mt-5" role="search">
      {children}
    </div>
  )
}

export function Surface({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`ui-surface rounded-group bg-surface p-5 sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}

export function StatCard({
  detail,
  icon,
  label,
  value,
}: {
  detail?: ReactNode
  icon?: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <article className="flex min-h-24 items-center gap-4 rounded-group bg-surface px-5 py-4 shadow-card">
      {icon && (
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-muted">{label}</p>
        <p className="numeric mt-0.5 text-2xl font-extrabold leading-tight text-ink">
          {value}
        </p>
        {detail && <div className="mt-1 text-xs text-ink-muted">{detail}</div>}
      </div>
    </article>
  )
}

type DataColumn<T> = {
  header: string
  key: keyof T
  priority: 'primary' | 'secondary'
  render?: (row: T) => ReactNode
}

function cellValue<T>(column: DataColumn<T>, row: T): ReactNode {
  if (column.render) return column.render(row)
  const value = row[column.key]
  return value == null ? '—' : String(value)
}

type DataViewProps<T extends object> = {
  actions?: (row: T) => ReactNode
  columns: Array<DataColumn<T>>
  getRowKey: (row: T) => Key
  label: string
  rows: T[]
}

export function ElevatedDataList<T extends object>({
  actions,
  columns,
  getRowKey,
  label,
  rows,
}: DataViewProps<T>) {
  return (
    <div className="data-list mt-4 min-w-0">
      <div
        className="hidden overflow-x-auto md:block"
        role="region"
        aria-label={`${label}: tabla desplazable`}
        tabIndex={0}
      >
        <table
          aria-label={label}
          className="w-full border-separate border-spacing-y-[10px] text-left text-sm"
        >
          <thead className="text-xs text-ink-muted">
            <tr>
              {columns.map((column) => (
                <th
                  className="px-5 py-2 font-normal"
                  key={String(column.key)}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
              {actions && (
                <th className="px-5 py-2 font-normal" scope="col">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className="align-middle transition-shadow duration-150 hover:shadow-row focus-within:shadow-row [&>td:first-child]:rounded-l-group [&>td:last-child]:rounded-r-group"
                key={getRowKey(row)}
              >
                {columns.map((column) => (
                  <td className="bg-surface px-5 py-3" key={String(column.key)}>
                    {cellValue(column, row)}
                  </td>
                ))}
                {actions && (
                  <td className="bg-surface px-5 py-2">{actions(row)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul
        aria-label={`${label} en pantalla estrecha`}
        className="space-y-3 md:hidden"
      >
        {rows.map((row) => (
          <li
            className="min-w-0 rounded-group bg-surface p-4 shadow-row"
            key={getRowKey(row)}
          >
            <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-3 gap-y-2 text-sm">
              {columns.map((column) => (
                <div className="contents" key={String(column.key)}>
                  <dt className="font-semibold text-ink-muted">
                    {column.header}
                  </dt>
                  <dd
                    className={
                      column.priority === 'primary'
                        ? 'min-w-0 break-words font-semibold text-ink'
                        : 'min-w-0 break-words text-ink'
                    }
                  >
                    {cellValue(column, row)}
                  </dd>
                </div>
              ))}
            </dl>
            {actions && <div className="mt-4 pt-2">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ResponsiveDataView<T extends object>(props: DataViewProps<T>) {
  return <ElevatedDataList {...props} />
}

export function Pagination({
  onNext,
  onPrevious,
  page,
  totalPages,
}: {
  onNext: () => void
  onPrevious: () => void
  page: number
  totalPages: number
}) {
  const normalizedTotal = Math.max(totalPages, 1)
  return (
    <nav
      aria-label="Paginación"
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <Button
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={onPrevious}
        variant="secondary"
      >
        Anterior
      </Button>
      <span className="numeric text-sm text-ink-muted">
        Página {page} de {normalizedTotal}
      </span>
      <Button
        aria-label="Página siguiente"
        disabled={page >= normalizedTotal}
        onClick={onNext}
        variant="secondary"
      >
        Siguiente
      </Button>
    </nav>
  )
}

export function RowActions({ children }: { children: ReactNode }) {
  return <ButtonGroup label="Acciones del registro">{children}</ButtonGroup>
}

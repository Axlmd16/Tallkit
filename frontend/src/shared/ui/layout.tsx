import type { HTMLAttributes, Key, ReactNode } from 'react'

import { Button } from './controls'
import { DataTable } from './data/DataTable'

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

export type FilterPanelLayout = 'stacked' | 'inline' | 'compact'

export interface FilterPanelProps {
  children: ReactNode
  label: string
  layout?: FilterPanelLayout
  onClear?: () => void
  clearLabel?: string
  className?: string
}

export function FilterPanel({
  children,
  label,
  layout = 'stacked',
  onClear,
  clearLabel = 'Limpiar filtros',
  className = '',
}: FilterPanelProps) {
  const layoutClasses =
    layout === 'inline'
      ? 'flex flex-wrap items-end gap-3'
      : layout === 'compact'
        ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3'
        : ''

  return (
    <div
      aria-label={label}
      className={`filter-panel mt-5 ${layoutClasses} ${className}`.trim()}
      role="search"
    >
      {children}
      {onClear && (
        <div className="flex items-center">
          <Button
            className="min-h-[40px]"
            onClick={onClear}
            type="button"
            variant="secondary"
          >
            {clearLabel}
          </Button>
        </div>
      )}
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
    <DataTable
      actions={actions}
      columns={columns}
      getRowKey={getRowKey}
      label={label}
      rows={rows}
      variant="elevated"
    />
  )
}

export function ResponsiveDataView<T extends object>(props: DataViewProps<T>) {
  return <ElevatedDataList {...props} />
}

export { Pagination, type PaginationProps } from './data/Pagination'

export { RowActions, type RowActionsProps } from './data/RowActions'

export { AppFrame, type AppFrameProps } from './layout/AppFrame'

export {
  DashboardLayout,
  type DashboardLayoutProps,
} from './layout/DashboardLayout'

export {
  MasterDetailLayout,
  type MasterDetailLayoutProps,
  type MasterDetailWidth,
} from './layout/MasterDetailLayout'

export {
  FormLayout,
  type FormActionsAlignment,
  type FormLayoutColumns,
  type FormLayoutProps,
} from './layout/FormLayout'

export {
  AuthLayout,
  type AuthLayoutProps,
  type AuthLayoutVariant,
} from './layout/AuthLayout'

export {
  PreviewLayout,
  type PreviewLayoutProps,
  type PreviewMobileView,
} from './layout/PreviewLayout'

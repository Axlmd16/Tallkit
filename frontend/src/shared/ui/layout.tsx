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
        <h1 className="text-[22px] leading-7 font-bold text-ink">{title}</h1>
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
  /** `bare`: sin panel propio, para la franja de filtros de un panel de lista. */
  bare?: boolean
}

export function FilterPanel({
  children,
  label,
  layout = 'stacked',
  onClear,
  clearLabel = 'Limpiar filtros',
  className = '',
  bare = false,
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
      className={`filter-panel ${bare ? '' : 'mt-5 rounded-panel border border-line bg-surface p-3'} ${layoutClasses} ${className}`.trim()}
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
      className={`ui-surface rounded-panel border border-line bg-surface p-4 sm:p-5 ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}

type DataColumn<T> = {
  header: string
  key: keyof T
  priority: 'primary' | 'secondary'
  render?: (row: T) => ReactNode
  align?: 'start' | 'end'
}

type DataViewProps<T extends object> = {
  actions?: (row: T) => ReactNode
  columns: Array<DataColumn<T>>
  getRowKey: (row: T) => Key
  label: string
  rows: T[]
  onRowClick?: ((row: T) => void) | undefined
  selectedKeys?: Key[] | Set<Key> | undefined
  onSelectRow?: ((key: Key, selected: boolean) => void) | undefined
  onSelectAll?: ((selected: boolean) => void) | undefined
}

export function ElevatedDataList<T extends object>({
  actions,
  columns,
  getRowKey,
  label,
  onRowClick,
  onSelectAll,
  onSelectRow,
  rows,
  selectedKeys,
}: DataViewProps<T>) {
  return (
    <DataTable
      actions={actions}
      columns={columns}
      getRowKey={getRowKey}
      label={label}
      onRowClick={onRowClick}
      onSelectAll={onSelectAll}
      onSelectRow={onSelectRow}
      rows={rows}
      selectedKeys={selectedKeys}
      variant="elevated"
    />
  )
}

export function ResponsiveDataView<T extends object>(props: DataViewProps<T>) {
  return <ElevatedDataList {...props} />
}

export { Pagination, type PaginationProps } from './data/Pagination'

export { RowActions, type RowActionsProps } from './data/RowActions'

export {
  FormLayout,
  type FormActionsAlignment,
  type FormLayoutColumns,
  type FormLayoutProps,
} from './layout/FormLayout'

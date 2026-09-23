import type { Key, ReactNode } from 'react'

export interface DataColumn<T> {
  key: keyof T | string
  header: string
  priority?: 'primary' | 'secondary' | undefined
  sortable?: boolean | undefined
  render?: ((row: T) => ReactNode) | undefined
  /** `end` alinea a la derecha importes y cantidades. */
  align?: 'start' | 'end' | undefined
}

export type DataTableVariant = 'elevated' | 'contained'
export type DataTableRowHeight = 'default' | '60' | '70'

export interface DataTableProps<T extends object> {
  label: string
  columns: DataColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => Key
  actions?: ((row: T) => ReactNode) | undefined
  variant?: DataTableVariant | undefined
  rowHeight?: DataTableRowHeight | undefined
  selectedKeys?: Key[] | Set<Key> | undefined
  onSelectRow?: ((key: Key, selected: boolean) => void) | undefined
  onSelectAll?: ((selected: boolean) => void) | undefined
  sortColumn?: string | undefined
  sortDirection?: ('ascending' | 'descending' | 'none') | undefined
  onSort?:
    | ((
        columnKey: string,
        nextDirection: 'ascending' | 'descending' | 'none',
      ) => void)
    | undefined
  className?: string | undefined
  tableClassName?: string | undefined
  onRowClick?: ((row: T) => void) | undefined
}

function cellValue<T extends object>(column: DataColumn<T>, row: T): ReactNode {
  if (column.render) {
    return column.render(row)
  }
  const key = column.key as keyof T
  const value = row[key]
  return value !== undefined && value !== null ? String(value) : null
}

const heightClasses: Record<DataTableRowHeight, string> = {
  default: 'py-2 h-12',
  60: 'py-2.5 h-[52px]',
  70: 'py-3 h-14',
}

export function DataTable<T extends object>({
  actions,
  className = '',
  columns,
  getRowKey,
  label,
  rowHeight = 'default',
  rows,
  tableClassName = '',
  variant = 'elevated',
  selectedKeys,
  onSelectRow,
  onSelectAll,
  sortColumn,
  sortDirection = 'none',
  onSort,
  onRowClick,
}: DataTableProps<T>) {
  // Tallkit presenta toda tabla contenida en un panel; `elevated` se conserva por compatibilidad.
  const isContained = variant === 'contained' || variant === 'elevated'
  const isSelectionActive = Boolean(onSelectRow || onSelectAll)

  const selectedSet = new Set(
    selectedKeys
      ? Array.isArray(selectedKeys)
        ? selectedKeys
        : Array.from(selectedKeys)
      : [],
  )

  const allSelected =
    rows.length > 0 && rows.every((row) => selectedSet.has(getRowKey(row)))
  const someSelected =
    rows.some((row) => selectedSet.has(getRowKey(row))) && !allSelected

  const tableLayoutClasses = isContained
    ? 'w-full border-collapse text-left text-[13px] bg-surface'
    : 'w-full border-collapse text-left text-[13px]'

  const theadClasses = isContained
    ? 'bg-surface-subtle border-b border-line text-[11.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase'
    : 'text-[11.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase'

  const rowBaseClasses = isContained
    ? 'align-middle transition-colors hover:bg-surface-subtle focus-within:bg-surface-subtle'
    : 'align-middle transition-colors hover:bg-surface-subtle'

  const cellHeightClass = heightClasses[rowHeight]

  return (
    <div
      className={`data-table-container mt-3 min-w-0 overflow-hidden rounded-panel border border-line bg-surface ${className}`.trim()}
    >
      <div
        aria-label={`${label}: tabla desplazable`}
        className="hidden overflow-x-auto md:block"
        role="region"
        tabIndex={0}
      >
        <table
          aria-label={label}
          className={`${tableLayoutClasses} ${tableClassName}`.trim()}
        >
          <thead className={theadClasses}>
            <tr>
              {isSelectionActive && (
                <th className="w-11 px-3 py-2 text-center" scope="col">
                  <input
                    aria-checked={someSelected ? 'mixed' : allSelected}
                    aria-label="Seleccionar todas las filas"
                    checked={allSelected}
                    className="size-4 rounded accent-accent cursor-pointer align-middle"
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected
                      }
                    }}
                    type="checkbox"
                  />
                </th>
              )}

              {columns.map((column) => {
                const isSorted = column.key === sortColumn
                const currentSort = isSorted ? sortDirection : undefined

                return (
                  <th
                    aria-sort={currentSort}
                    className={`h-9 px-3 py-2 font-semibold ${column.align === 'end' ? 'text-right' : ''}`.trim()}
                    key={String(column.key)}
                    scope="col"
                  >
                    {column.sortable && onSort ? (
                      <button
                        className="inline-flex items-center gap-1 font-semibold uppercase text-ink-muted hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                        onClick={() => {
                          const nextDirection =
                            currentSort === 'ascending'
                              ? 'descending'
                              : currentSort === 'descending'
                                ? 'none'
                                : 'ascending'
                          onSort(String(column.key), nextDirection)
                        }}
                        type="button"
                      >
                        <span>{column.header}</span>
                        <span
                          aria-hidden="true"
                          className="text-xs text-ink-muted"
                        >
                          {currentSort === 'ascending'
                            ? '▲'
                            : currentSort === 'descending'
                              ? '▼'
                              : '↕'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}

              {actions && (
                <th className="h-9 px-3 py-2 font-semibold" scope="col">
                  Acciones
                </th>
              )}
            </tr>
          </thead>

          <tbody className={isContained ? 'divide-y divide-line' : ''}>
            {rows.map((row) => {
              const rowKey = getRowKey(row)
              const isSelected = selectedSet.has(rowKey)

              return (
                <tr
                  className={`${rowBaseClasses} ${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-accent-soft/60' : ''}`.trim()}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => {
                    if (
                      onRowClick &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault()
                      onRowClick(row)
                    }
                  }}
                  key={rowKey}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {isSelectionActive && (
                    <td
                      className={`px-3 text-center ${isContained ? '' : 'bg-surface'} ${cellHeightClass}`.trim()}
                    >
                      <input
                        aria-label={`Seleccionar fila ${rowKey}`}
                        checked={isSelected}
                        className="size-4 rounded accent-accent cursor-pointer align-middle"
                        onChange={(e) =>
                          onSelectRow?.(rowKey, e.target.checked)
                        }
                        type="checkbox"
                      />
                    </td>
                  )}

                  {columns.map((column) => (
                    <td
                      className={`px-3 ${column.align === 'end' ? 'text-right' : ''} ${isContained ? '' : 'bg-surface'} ${cellHeightClass}`.trim()}
                      key={String(column.key)}
                    >
                      {cellValue(column, row)}
                    </td>
                  ))}

                  {actions && (
                    <td
                      className={`px-3 ${isContained ? '' : 'bg-surface'} ${cellHeightClass}`.trim()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {actions(row)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul
        aria-label={`${label} en pantalla estrecha`}
        className="divide-y divide-line md:hidden"
      >
        {rows.map((row) => {
          const rowKey = getRowKey(row)
          const isSelected = selectedSet.has(rowKey)

          return (
            <li
              className={`min-w-0 px-4 py-3 ${
                isSelected ? 'bg-accent-soft/60' : ''
              } ${onRowClick ? 'cursor-pointer' : ''}`}
              key={rowKey}
              onClick={() => onRowClick?.(row)}
            >
              {isSelectionActive && (
                <div className="mb-2 flex items-center gap-2">
                  <label className="inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-ink cursor-pointer">
                    <input
                      checked={isSelected}
                      className="size-4 rounded accent-accent"
                      onChange={(e) => onSelectRow?.(rowKey, e.target.checked)}
                      type="checkbox"
                    />
                    <span>Seleccionar registro</span>
                  </label>
                </div>
              )}

              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13.5px] font-semibold text-ink">
                {columns
                  .filter((column) => column.priority === 'primary')
                  .map((column) => (
                    <span
                      className="min-w-0 break-words"
                      key={String(column.key)}
                    >
                      <span className="sr-only">{column.header}: </span>
                      {cellValue(column, row)}
                    </span>
                  ))}
              </div>
              <dl className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                {columns
                  .filter((column) => column.priority !== 'primary')
                  .map((column) => (
                    <div
                      className="flex min-w-0 items-center gap-1"
                      key={String(column.key)}
                    >
                      <dt className="sr-only">{column.header}</dt>
                      <dd className="min-w-0 break-words">
                        {cellValue(column, row)}
                      </dd>
                    </div>
                  ))}
              </dl>

              {actions && (
                <div className="mt-2">
                  <div onClick={(event) => event.stopPropagation()}>
                    {actions(row)}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

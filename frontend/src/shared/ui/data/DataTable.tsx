import type { Key, ReactNode } from 'react'

export interface DataColumn<T> {
  key: keyof T | string
  header: string
  priority?: 'primary' | 'secondary' | undefined
  sortable?: boolean | undefined
  render?: ((row: T) => ReactNode) | undefined
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
  default: 'py-3 min-h-[52px]',
  60: 'py-3.5 h-[60px]',
  70: 'py-5 h-[70px]',
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
  const isContained = variant === 'contained'
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
    ? 'w-full border-collapse text-left text-sm divide-y divide-line bg-surface rounded-group border border-line overflow-hidden'
    : 'w-full border-separate border-spacing-y-[10px] text-left text-sm'

  const theadClasses = isContained
    ? 'bg-canvas border-b border-line text-xs text-ink-muted'
    : 'text-xs text-ink-muted'

  const rowBaseClasses = isContained
    ? 'align-middle transition-colors hover:bg-surface-selected/30 focus-within:bg-surface-selected/30'
    : 'align-middle transition-shadow duration-150 hover:shadow-row focus-within:shadow-row [&>td:first-child]:rounded-l-group [&>td:last-child]:rounded-r-group'

  const cellHeightClass = heightClasses[rowHeight]

  return (
    <div className={`data-table-container mt-4 min-w-0 ${className}`.trim()}>
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
                <th className="w-12 px-4 py-2 text-center" scope="col">
                  <input
                    aria-checked={someSelected ? 'mixed' : allSelected}
                    aria-label="Seleccionar todas las filas"
                    checked={allSelected}
                    className="size-5 rounded accent-primary cursor-pointer align-middle"
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
                    className="px-5 py-2 font-normal"
                    key={String(column.key)}
                    scope="col"
                  >
                    {column.sortable && onSort ? (
                      <button
                        className="inline-flex items-center gap-1 font-semibold text-ink hover:text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
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
                <th className="px-5 py-2 font-normal" scope="col">
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
                  className={`${rowBaseClasses} ${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-surface-selected/40' : ''}`.trim()}
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
                      className={`px-4 text-center ${isContained ? '' : 'bg-surface'} ${cellHeightClass}`.trim()}
                    >
                      <input
                        aria-label={`Seleccionar fila ${rowKey}`}
                        checked={isSelected}
                        className="size-5 rounded accent-primary cursor-pointer align-middle"
                        onChange={(e) =>
                          onSelectRow?.(rowKey, e.target.checked)
                        }
                        type="checkbox"
                      />
                    </td>
                  )}

                  {columns.map((column) => (
                    <td
                      className={`px-5 ${isContained ? '' : 'bg-surface'} ${cellHeightClass}`.trim()}
                      key={String(column.key)}
                    >
                      {cellValue(column, row)}
                    </td>
                  ))}

                  {actions && (
                    <td
                      className={`px-5 ${isContained ? '' : 'bg-surface'} ${cellHeightClass}`.trim()}
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
        className="space-y-3 md:hidden"
      >
        {rows.map((row) => {
          const rowKey = getRowKey(row)
          const isSelected = selectedSet.has(rowKey)

          return (
            <li
              className={`min-w-0 rounded-group bg-surface p-4 shadow-row border ${
                isSelected ? 'border-primary' : 'border-transparent'
              } ${onRowClick ? 'cursor-pointer' : ''}`}
              key={rowKey}
              onClick={() => onRowClick?.(row)}
            >
              {isSelectionActive && (
                <div className="mb-3 pb-2 border-b border-line flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer">
                    <input
                      checked={isSelected}
                      className="size-5 rounded accent-primary"
                      onChange={(e) => onSelectRow?.(rowKey, e.target.checked)}
                      type="checkbox"
                    />
                    <span>Seleccionar registro</span>
                  </label>
                </div>
              )}

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

              {actions && (
                <div className="mt-4 pt-2 border-t border-line">
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

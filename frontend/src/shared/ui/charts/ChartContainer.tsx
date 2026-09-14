import { useState, type ReactNode } from 'react'

import { Button } from '../actions'
import { EmptyState } from '../feedback'

export interface ChartContainerProps {
  title: string
  subtitle?: string | undefined
  actions?: ReactNode | undefined
  legend?: ReactNode | undefined
  children: ReactNode
  tableAlternative?: ReactNode | undefined
  empty?: boolean | undefined
  emptyMessage?: string | undefined
  className?: string | undefined
}

export function ChartContainer({
  actions,
  children,
  className = '',
  empty = false,
  emptyMessage = 'No hay datos disponibles para mostrar en este gráfico.',
  legend,
  subtitle,
  tableAlternative,
  title,
}: ChartContainerProps) {
  const [showTable, setShowTable] = useState(false)

  return (
    <div
      className={`bg-surface border border-border-subtle rounded-panel p-5 shadow-card flex flex-col gap-4 text-ink ${className}`.trim()}
      data-testid="chart-container-root"
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-ink truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tableAlternative && !empty && (
            <Button
              onClick={() => setShowTable((prev) => !prev)}
              size="40"
              variant="quiet"
            >
              {showTable ? 'Ver gráfico' : 'Ver tabla de datos'}
            </Button>
          )}
          {actions}
        </div>
      </header>

      <div className="flex-1 w-full min-h-[220px] flex flex-col justify-center">
        {empty ? (
          <EmptyState
            description={emptyMessage}
            title="Sin datos disponibles"
          />
        ) : showTable && tableAlternative ? (
          <div className="w-full overflow-x-auto py-2">{tableAlternative}</div>
        ) : (
          <div className="w-full overflow-x-auto py-2">{children}</div>
        )}
      </div>

      {legend && !empty && !showTable && (
        <footer className="pt-2 border-t border-border-subtle">{legend}</footer>
      )}
    </div>
  )
}

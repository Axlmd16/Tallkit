import React from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

export type CalendarView = 'day' | 'month' | 'year'

export interface CalendarToolbarProps {
  title: string
  currentView?: CalendarView | undefined
  onViewChange?: ((view: CalendarView) => void) | undefined
  onPrevious?: (() => void) | undefined
  onNext?: (() => void) | undefined
  onToday?: (() => void) | undefined
  actions?: React.ReactNode | undefined
  className?: string | undefined
}

export function CalendarToolbar({
  actions,
  className = '',
  currentView = 'month',
  onNext,
  onPrevious,
  onToday,
  onViewChange,
  title,
}: CalendarToolbarProps) {
  const views: Array<{ id: CalendarView; label: string }> = [
    { id: 'day', label: 'Día' },
    { id: 'month', label: 'Mes' },
    { id: 'year', label: 'Año' },
  ]

  return (
    <div
      aria-label="Barra de herramientas de calendario"
      className={`flex flex-wrap items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-xl border border-line/40 text-ink shadow-sm ${className}`}
      role="toolbar"
    >
      {/* Título y navegación previa/siguiente/hoy */}
      <div className="flex items-center gap-2 sm:gap-3">
        <h2 className="text-base sm:text-lg font-bold text-ink tracking-tight mr-1">
          {title}
        </h2>

        <div className="flex items-center gap-1">
          <button
            aria-label="Periodo anterior"
            className="inline-flex size-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-selected hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            onClick={onPrevious}
            type="button"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <button
            aria-label="Periodo siguiente"
            className="inline-flex size-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-selected hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            onClick={onNext}
            type="button"
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>

        {onToday && (
          <button
            className="min-h-11 min-w-11 rounded-lg border border-line/60 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-surface-selected focus:outline-none focus:ring-2 focus:ring-primary/40"
            onClick={onToday}
            type="button"
          >
            Hoy
          </button>
        )}
      </div>

      {/* Selector de vistas (Día / Mes / Año) y acciones opcionales */}
      <div className="flex items-center gap-3 ml-auto">
        <div
          aria-label="Cambiar vista de calendario"
          className="inline-flex items-center p-0.5 rounded-lg bg-surface-muted border border-line/40 text-xs font-medium"
          role="group"
        >
          {views.map((v) => {
            const isActive = currentView === v.id
            return (
              <button
                key={v.id}
                aria-pressed={isActive}
                className={`min-h-11 min-w-11 rounded-md px-3 py-1 transition-all ${
                  isActive
                    ? 'bg-surface text-ink font-semibold shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
                onClick={() => onViewChange?.(v.id)}
                type="button"
              >
                {v.label}
              </button>
            )
          })}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

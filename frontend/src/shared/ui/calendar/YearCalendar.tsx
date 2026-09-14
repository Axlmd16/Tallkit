import React from 'react'
import { MiniCalendar } from './MiniCalendar'
import { formatYearMonth, getMonthName } from './calendar-utils'

export interface YearCalendarProps {
  year: number
  selectedDate?: string | undefined
  today?: string | undefined
  onSelectDate?: ((dateStr: string) => void) | undefined
  onSelectMonth?: ((yearMonthStr: string) => void) | undefined
  className?: string | undefined
  ariaLabel?: string | undefined
}

export function YearCalendar({
  ariaLabel,
  className = '',
  onSelectDate,
  onSelectMonth,
  selectedDate,
  today = '2026-09-13',
  year = 2026,
}: YearCalendarProps) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const resolvedAriaLabel = ariaLabel || `Calendario anual ${year}`

  return (
    <div
      aria-label={resolvedAriaLabel}
      className={`w-full ${className}`}
      role="region"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {months.map((m) => {
          const monthStr = formatYearMonth(year, m)
          const monthName = getMonthName(m)

          return (
            <div
              key={monthStr}
              className="flex flex-col bg-surface rounded-xl border border-border/40 p-3 shadow-xs hover:border-border transition-colors"
            >
              {/* Encabezado de mes con enlace/botón de apertura */}
              <div className="flex items-center justify-between mb-2 px-1">
                {onSelectMonth ? (
                  <button
                    aria-label={`Ver ${monthName.toLowerCase()}`}
                    className="text-sm font-bold text-ink hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 rounded px-1 -mx-1"
                    onClick={() => onSelectMonth(monthStr)}
                    type="button"
                  >
                    {monthName}
                  </button>
                ) : (
                  <span className="text-sm font-bold text-ink">
                    {monthName}
                  </span>
                )}
                <span className="text-xs text-ink-muted font-medium">
                  {year}
                </span>
              </div>

              {/* MiniCalendar incrustado sin cabecera de navegación */}
              <div className="flex justify-center">
                <MiniCalendar
                  ariaLabel={`Días de ${monthName} ${year}`}
                  className="max-w-none border-0 p-0 shadow-none bg-transparent"
                  compact
                  currentMonth={monthStr}
                  onSelectDate={onSelectDate}
                  selectedDate={selectedDate}
                  showHeader={false}
                  today={today}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

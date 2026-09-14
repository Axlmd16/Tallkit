import React from 'react'
import {
  formatDate,
  getDaysInMonth,
  getFirstDayOfWeek,
  getMonthName,
  parseYearMonth,
  shiftMonth,
} from './calendar-utils'

export interface CalendarEventItem {
  id: string
  date: string // 'YYYY-MM-DD'
  title: string
  tone?: 'primary' | 'success' | 'warning' | 'info' | 'neutral' | undefined
  time?: string | undefined
}

export interface MonthCalendarProps {
  currentMonth: string // 'YYYY-MM'
  selectedDate?: string | undefined // 'YYYY-MM-DD'
  today?: string | undefined // 'YYYY-MM-DD'
  events?: CalendarEventItem[] | undefined
  onSelectDate?: ((dateStr: string) => void) | undefined
  onSelectEvent?: ((event: CalendarEventItem) => void) | undefined
  className?: string | undefined
  ariaLabel?: string | undefined
}

const WEEKDAYS_FULL_ES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const

const toneClassMap: Record<string, string> = {
  primary:
    'bg-primary/10 text-primary-strong border-primary/25 hover:bg-primary/20',
  success:
    'bg-emerald-500/15 text-emerald-950 dark:text-emerald-200 border-emerald-600/30 hover:bg-emerald-500/25',
  warning:
    'bg-amber-500/15 text-amber-950 dark:text-amber-200 border-amber-600/30 hover:bg-amber-500/25',
  info: 'bg-sky-500/15 text-sky-950 dark:text-sky-200 border-sky-600/30 hover:bg-sky-500/25',
  neutral:
    'bg-surface-muted text-ink border-border/50 hover:bg-surface-selected',
}

export function MonthCalendar({
  ariaLabel = 'Calendario mensual',
  className = '',
  currentMonth,
  events = [],
  onSelectDate,
  onSelectEvent,
  selectedDate,
  today = '2026-09-13',
}: MonthCalendarProps) {
  const { year, month } = parseYearMonth(currentMonth)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfWeek(year, month)

  const prevYearMonth = shiftMonth(currentMonth, -1)
  const { year: prevYear, month: prevMonth } = parseYearMonth(prevYearMonth)
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)

  const nextYearMonth = shiftMonth(currentMonth, 1)
  const { year: nextYear, month: nextMonth } = parseYearMonth(nextYearMonth)

  interface MonthCellDay {
    dateStr: string
    dayNumber: number
    monthNumber: number
    yearNumber: number
    isOutside: boolean
    isToday: boolean
    isSelected: boolean
    dayEvents: CalendarEventItem[]
  }

  const cells: MonthCellDay[] = []

  // Días previos
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNumber = daysInPrevMonth - i
    const dateStr = formatDate(prevYear, prevMonth, dayNumber)
    cells.push({
      dateStr,
      dayNumber,
      monthNumber: prevMonth,
      yearNumber: prevYear,
      isOutside: true,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
      dayEvents: events.filter((e) => e.date === dateStr),
    })
  }

  // Días actuales
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d)
    cells.push({
      dateStr,
      dayNumber: d,
      monthNumber: month,
      yearNumber: year,
      isOutside: false,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
      dayEvents: events.filter((e) => e.date === dateStr),
    })
  }

  // Días posteriores
  const remaining = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= remaining; d++) {
    const dateStr = formatDate(nextYear, nextMonth, d)
    cells.push({
      dateStr,
      dayNumber: d,
      monthNumber: nextMonth,
      yearNumber: nextYear,
      isOutside: true,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
      dayEvents: events.filter((e) => e.date === dateStr),
    })
  }

  const weeks: MonthCellDay[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`w-full overflow-hidden rounded-xl border border-border/40 bg-surface text-ink shadow-sm select-none ${className}`}
      role="grid"
    >
      {/* Encabezado con los 7 días de la semana */}
      <div
        className="grid grid-cols-7 border-b border-border/40 bg-surface-muted text-center text-xs font-semibold text-ink-muted"
        role="row"
      >
        {WEEKDAYS_FULL_ES.map((dayName) => (
          <div
            key={dayName}
            className="py-2.5 px-1 truncate"
            role="columnheader"
          >
            <span className="hidden sm:inline">{dayName}</span>
            <span className="sm:hidden">{dayName.slice(0, 2)}</span>
          </div>
        ))}
      </div>

      {/* Retícula de celdas dividida en filas de semana */}
      <div className="divide-y divide-border/30 bg-border/20">
        {weeks.map((week, wIdx) => (
          <div
            key={wIdx}
            className="grid grid-cols-7 divide-x divide-border/30"
            role="row"
          >
            {week.map((cell) => {
              const ariaCellLabel = `${cell.dayNumber} de ${getMonthName(
                cell.monthNumber,
              ).toLowerCase()} de ${cell.yearNumber}`

              return (
                <div
                  key={cell.dateStr}
                  aria-label={ariaCellLabel}
                  aria-selected={cell.isSelected}
                  className={`min-h-[85px] sm:min-h-[110px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    cell.isOutside
                      ? 'bg-surface-muted/60 text-ink-muted'
                      : cell.isSelected
                        ? 'bg-primary/5 text-ink'
                        : 'bg-surface hover:bg-surface-selected/40 text-ink'
                  }`}
                  data-outside-month={cell.isOutside ? 'true' : undefined}
                  data-today={cell.isToday ? 'true' : undefined}
                  onClick={() => onSelectDate?.(cell.dateStr)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectDate?.(cell.dateStr)
                    }
                  }}
                  role="gridcell"
                  tabIndex={0}
                >
                  {/* Número del día */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center justify-center text-xs font-semibold size-6 rounded-full ${
                        cell.isToday
                          ? 'bg-primary text-white font-bold'
                          : cell.isSelected
                            ? 'text-primary-strong font-bold'
                            : ''
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {cell.dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-ink-muted sm:hidden">
                        {cell.dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Bloques de eventos neutrales */}
                  <div className="mt-1 space-y-1 overflow-hidden flex-1">
                    {cell.dayEvents.slice(0, 3).map((ev) => {
                      const toneClass = toneClassMap[ev.tone ?? 'primary']
                      return (
                        <button
                          key={ev.id}
                          aria-label={`${ev.title}${
                            ev.time ? ` a las ${ev.time}` : ''
                          }`}
                          className={`w-full text-left truncate px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-medium border transition-colors ${toneClass}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectEvent?.(ev)
                          }}
                          type="button"
                        >
                          {ev.time && (
                            <span className="font-bold mr-1">{ev.time}</span>
                          )}
                          <span>{ev.title}</span>
                        </button>
                      )
                    })}
                    {cell.dayEvents.length > 3 && (
                      <span className="hidden sm:inline-block text-[10px] font-semibold text-ink-muted pl-1">
                        +{cell.dayEvents.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

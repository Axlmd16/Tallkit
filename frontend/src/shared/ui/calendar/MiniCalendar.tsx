import React, { useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import {
  WEEKDAY_SHORT_ES,
  formatDate,
  formatYearMonth,
  getDaysInMonth,
  getFirstDayOfWeek,
  getMonthName,
  parseYearMonth,
  shiftMonth,
} from './calendar-utils'

export interface MiniCalendarProps {
  currentMonth?: string | undefined // 'YYYY-MM'
  selectedDate?: string | undefined // 'YYYY-MM-DD'
  today?: string | undefined // 'YYYY-MM-DD' fecha fija de referencia
  onSelectDate?: ((dateStr: string) => void) | undefined
  onMonthChange?: ((monthStr: string) => void) | undefined
  showHeader?: boolean | undefined
  compact?: boolean | undefined
  className?: string | undefined
  ariaLabel?: string | undefined
}

interface CalendarDay {
  dateStr: string
  dayNumber: number
  monthNumber: number
  yearNumber: number
  isOutside: boolean
  isToday: boolean
  isSelected: boolean
}

export function MiniCalendar({
  ariaLabel = 'Calendario compacto',
  className = '',
  compact = false,
  currentMonth: controlledMonth,
  onMonthChange,
  onSelectDate,
  selectedDate,
  showHeader = true,
  today = '2026-09-13',
}: MiniCalendarProps) {
  const [internalMonth, setInternalMonth] = useState(
    controlledMonth || selectedDate?.slice(0, 7) || '2026-09',
  )

  const activeMonthStr = controlledMonth || internalMonth
  const { year, month } = parseYearMonth(activeMonthStr)

  const handleMonthShift = (delta: number) => {
    const nextMonth = shiftMonth(activeMonthStr, delta)
    if (!controlledMonth) {
      setInternalMonth(nextMonth)
    }
    onMonthChange?.(nextMonth)
  }

  // Generar días del mes con relleno previo y posterior
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfWeek(year, month) // 0=Lunes ... 6=Domingo

  const prevYearMonth = shiftMonth(activeMonthStr, -1)
  const { year: prevYear, month: prevMonth } = parseYearMonth(prevYearMonth)
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)

  const nextYearMonth = shiftMonth(activeMonthStr, 1)
  const { year: nextYear, month: nextMonth } = parseYearMonth(nextYearMonth)

  const days: CalendarDay[] = []

  // Relleno días del mes anterior
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNumber = daysInPrevMonth - i
    const dateStr = formatDate(prevYear, prevMonth, dayNumber)
    days.push({
      dateStr,
      dayNumber,
      monthNumber: prevMonth,
      yearNumber: prevYear,
      isOutside: true,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
    })
  }

  // Días del mes actual
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d)
    days.push({
      dateStr,
      dayNumber: d,
      monthNumber: month,
      yearNumber: year,
      isOutside: false,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
    })
  }

  // Relleno días del mes siguiente (para completar múltiplo de 7)
  const remainingDays = (7 - (days.length % 7)) % 7
  for (let d = 1; d <= remainingDays; d++) {
    const dateStr = formatDate(nextYear, nextMonth, d)
    days.push({
      dateStr,
      dayNumber: d,
      monthNumber: nextMonth,
      yearNumber: nextYear,
      isOutside: true,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
    })
  }

  const handleDaySelect = (day: CalendarDay) => {
    onSelectDate?.(day.dateStr)
    if (day.isOutside) {
      const targetMonth = formatYearMonth(day.yearNumber, day.monthNumber)
      if (!controlledMonth) setInternalMonth(targetMonth)
      onMonthChange?.(targetMonth)
    }
  }

  const weeks: CalendarDay[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`w-full ${compact ? 'max-w-[240px] p-2' : 'max-w-[289px] p-3.5'} bg-surface rounded-xl border border-border/40 text-ink shadow-sm select-none ${className}`}
    >
      {/* Cabecera de mes y controles de navegación */}
      {showHeader && (
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm font-bold text-ink tracking-tight">
            {getMonthName(month)} {year}
          </span>
          <div className="flex items-center gap-1">
            <button
              aria-label="Mes anterior"
              className="inline-flex items-center justify-center size-7 rounded-md text-ink-muted hover:text-ink hover:bg-surface-selected transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              onClick={() => handleMonthShift(-1)}
              type="button"
            >
              <CaretLeft size={14} weight="bold" />
            </button>
            <button
              aria-label="Mes siguiente"
              className="inline-flex items-center justify-center size-7 rounded-md text-ink-muted hover:text-ink hover:bg-surface-selected transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              onClick={() => handleMonthShift(1)}
              type="button"
            >
              <CaretRight size={14} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Cuadrícula accesible con filas de semana */}
      <div className="space-y-1 text-center" role="grid">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-1 text-center" role="row">
          {WEEKDAY_SHORT_ES.map((dayName) => (
            <span
              key={dayName}
              className="text-[11px] font-semibold text-ink-muted"
              role="columnheader"
            >
              {dayName}
            </span>
          ))}
        </div>

        {/* Semanas */}
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="grid grid-cols-7 gap-1" role="row">
            {week.map((day) => {
              const formattedAriaLabel = `${day.dayNumber} de ${getMonthName(
                day.monthNumber,
              ).toLowerCase()} de ${day.yearNumber}`

              let dayClasses =
                'relative inline-flex items-center justify-center size-8 rounded-full text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 '

              if (day.isSelected) {
                dayClasses += 'bg-primary text-white font-bold shadow-xs'
              } else if (day.isToday) {
                dayClasses +=
                  'border border-primary text-primary font-bold hover:bg-primary/10'
              } else if (day.isOutside) {
                dayClasses +=
                  'text-ink-muted hover:text-ink hover:bg-surface-selected'
              } else {
                dayClasses += 'text-ink font-semibold hover:bg-surface-selected'
              }

              return (
                <div key={day.dateStr} className="p-0.5" role="gridcell">
                  <button
                    aria-label={formattedAriaLabel}
                    aria-pressed={day.isSelected}
                    className={dayClasses}
                    data-outside-month={day.isOutside ? 'true' : undefined}
                    data-today={day.isToday ? 'true' : undefined}
                    onClick={() => handleDaySelect(day)}
                    type="button"
                  >
                    {day.dayNumber}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

import React from 'react'
import { pad2 } from './calendar-utils'

export interface DayCalendarEvent {
  id: string
  title: string
  subtitle?: string | undefined
  startTime: string // 'HH:MM'
  endTime: string // 'HH:MM'
  tone?: 'primary' | 'success' | 'warning' | 'info' | 'neutral' | undefined
}

export interface DayCalendarProps {
  date: string // 'YYYY-MM-DD'
  events?: DayCalendarEvent[] | undefined
  startHour?: number | undefined // por defecto 8 (08:00)
  endHour?: number | undefined // por defecto 19 (19:00)
  onSelectTimeSlot?: ((timeStr: string) => void) | undefined
  onSelectEvent?: ((event: DayCalendarEvent) => void) | undefined
  className?: string | undefined
  ariaLabel?: string | undefined
}

const toneClassMap: Record<string, string> = {
  primary:
    'bg-primary/10 border-primary text-primary-strong hover:bg-primary/20 focus:ring-primary/40',
  success:
    'bg-emerald-500/15 border-emerald-600 text-emerald-950 dark:text-emerald-200 hover:bg-emerald-500/25 focus:ring-emerald-500/40',
  warning:
    'bg-amber-500/15 border-amber-600 text-amber-950 dark:text-amber-200 hover:bg-amber-500/25 focus:ring-amber-500/40',
  info: 'bg-sky-500/15 border-sky-600 text-sky-950 dark:text-sky-200 hover:bg-sky-500/25 focus:ring-sky-500/40',
  neutral:
    'bg-surface-muted border-border/80 text-ink hover:bg-surface-selected focus:ring-primary/40',
}

function timeToMinutes(timeStr: string, startHour: number): number {
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr ?? '0', 10)
  const m = parseInt(mStr ?? '0', 10)
  return (h - startHour) * 60 + m
}

export function DayCalendar({
  ariaLabel,
  className = '',
  date,
  endHour = 19,
  events = [],
  onSelectEvent,
  onSelectTimeSlot,
  startHour = 8,
}: DayCalendarProps) {
  const resolvedAriaLabel = ariaLabel || `Calendario diario ${date}`
  const rowHeight = 64 // píxeles por hora
  const totalHours = Math.max(endHour - startHour, 1)

  // Horas del eje vertical
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i)

  // Cálculo de solapamientos para distribuir eventos concurrentes
  interface PositionedEvent {
    event: DayCalendarEvent
    startMin: number
    endMin: number
    top: number
    height: number
    colIndex: number
    totalCols: number
  }

  const parsedEvents = events
    .map((ev) => {
      const startMin = Math.max(timeToMinutes(ev.startTime, startHour), 0)
      const endMin = Math.min(
        timeToMinutes(ev.endTime, startHour),
        totalHours * 60,
      )
      return {
        event: ev,
        startMin,
        endMin: Math.max(endMin, startMin + 20), // duración mínima de 20 min
        top: (startMin / 60) * rowHeight,
        height: Math.max(((endMin - startMin) / 60) * rowHeight, 28),
      }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  // Asignar columnas deterministas a los eventos que se solapan
  const positionedEvents: PositionedEvent[] = []

  // Agrupar en racimos de solapamiento
  let currentCluster: typeof parsedEvents = []
  let clusterEnd = -1

  for (const item of parsedEvents) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item)
      clusterEnd = Math.max(clusterEnd, item.endMin)
    } else {
      // Resolver cluster previo
      layoutCluster(currentCluster, positionedEvents)
      currentCluster = [item]
      clusterEnd = item.endMin
    }
  }
  if (currentCluster.length > 0) {
    layoutCluster(currentCluster, positionedEvents)
  }

  function layoutCluster(
    cluster: typeof parsedEvents,
    result: PositionedEvent[],
  ) {
    const columns: number[] = [] // almacena el tiempo de finalización de cada columna

    for (const item of cluster) {
      let assignedCol = 0
      while (
        assignedCol < columns.length &&
        columns[assignedCol]! > item.startMin
      ) {
        assignedCol++
      }
      columns[assignedCol] = item.endMin
      result.push({
        ...item,
        colIndex: assignedCol,
        totalCols: 1, // se ajustará después
      })
    }

    const clusterCols = Math.max(columns.length, 1)
    // Asignar totalCols a los miembros del cluster
    const clusterSlice = result.slice(result.length - cluster.length)
    for (const p of clusterSlice) {
      p.totalCols = clusterCols
    }
  }

  return (
    <div
      aria-label={resolvedAriaLabel}
      className={`w-full overflow-x-auto rounded-xl border border-border/40 bg-surface text-ink shadow-sm select-none ${className}`}
      role="region"
    >
      <div
        className="relative flex min-w-[500px]"
        style={{ height: totalHours * rowHeight + 32 }}
      >
        {/* Eje de tiempo a la izquierda */}
        <div className="w-16 shrink-0 border-r border-border/40 pt-2 bg-surface-muted/30">
          {hours.map((h, i) => (
            <div
              key={h}
              className="relative text-right pr-3 text-[11px] font-semibold text-ink-muted select-none"
              style={{ height: i < totalHours ? rowHeight : 0 }}
            >
              <span>{pad2(h)}:00</span>
            </div>
          ))}
        </div>

        {/* Rejilla horaria y contenedor de bloques */}
        <div className="relative flex-1">
          {/* Filas horarias con botón accesible de franja */}
          {hours.slice(0, totalHours).map((h) => {
            const timeStr = `${pad2(h)}:00`
            return (
              <div
                key={h}
                className="group relative border-b border-border/25 transition-colors hover:bg-surface-selected/30"
                style={{ height: rowHeight }}
              >
                <button
                  aria-label={`Programar en franja de las ${timeStr}`}
                  className="size-full text-left outline-none focus:bg-surface-selected/50"
                  onClick={() => onSelectTimeSlot?.(timeStr)}
                  type="button"
                />
              </div>
            )
          })}

          {/* Bloques de eventos posicionados */}
          {positionedEvents.map(
            ({ colIndex, event, height, top, totalCols }) => {
              const widthPct = 100 / totalCols
              const leftPct = colIndex * widthPct
              const toneClass = toneClassMap[event.tone ?? 'primary']

              return (
                <button
                  key={event.id}
                  aria-label={`${event.title}${
                    event.subtitle ? `, ${event.subtitle}` : ''
                  } de ${event.startTime} a ${event.endTime}`}
                  className={`absolute z-10 flex flex-col justify-start overflow-hidden rounded-lg border-l-4 border p-2 text-left shadow-xs transition-all focus:outline-none focus:ring-2 ${toneClass}`}
                  data-overlap-cols={totalCols}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectEvent?.(event)
                  }}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `calc(${leftPct}% + 4px)`,
                    width: `calc(${widthPct}% - 8px)`,
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold leading-tight">
                    <span className="truncate">{event.title}</span>
                    <span className="shrink-0 text-[10px] font-semibold ml-1">
                      {event.startTime} - {event.endTime}
                    </span>
                  </div>
                  {event.subtitle && (
                    <span className="truncate text-[10px] font-medium mt-0.5">
                      {event.subtitle}
                    </span>
                  )}
                </button>
              )
            },
          )}
        </div>
      </div>
    </div>
  )
}

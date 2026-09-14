import type { KeyboardEvent } from 'react'

export type TimelineTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'info'
  | 'neutral'

export interface TimelineRow {
  id: string
  label: string
  description?: string | undefined
  start: number
  end: number
  tone?: TimelineTone | undefined
}

export interface TimelineTick {
  value: number
  label: string
}

export interface TimelineProps {
  rows: TimelineRow[]
  start: number
  end: number
  ticks?: TimelineTick[] | undefined
  ariaLabel?: string | undefined
  onSelectRow?: ((row: TimelineRow) => void) | undefined
  selectedRowId?: string | undefined
  className?: string | undefined
}

const toneClasses: Record<TimelineTone, string> = {
  primary: 'border-primary bg-primary/15 text-primary-strong',
  success: 'border-success bg-success/15 text-success',
  warning: 'border-warning bg-warning/15 text-ink',
  info: 'border-info bg-info/15 text-ink',
  neutral: 'border-border bg-surface-muted text-ink',
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function Timeline({
  ariaLabel = 'Cronograma',
  className = '',
  end,
  onSelectRow,
  rows,
  selectedRowId,
  start,
  ticks = [],
}: TimelineProps) {
  const range = Math.max(end - start, 1)
  const percentage = (value: number) =>
    ((clamp(value, start, end) - start) / range) * 100

  function activate(event: KeyboardEvent<HTMLButtonElement>, row: TimelineRow) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectRow?.(row)
    }
  }

  return (
    <section
      aria-label={ariaLabel}
      className={`w-full min-w-0 rounded-group bg-surface text-ink ${className}`.trim()}
    >
      <div
        aria-label={`${ariaLabel}: región desplazable`}
        className="overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <div className="min-w-[640px] p-4">
          <div className="grid grid-cols-[10rem_minmax(28rem,1fr)] gap-3 border-b border-border pb-2 text-xs text-ink-muted">
            <span>Elemento</span>
            <div className="relative h-5" aria-hidden="true">
              {ticks.map((tick) => (
                <span
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  key={`${tick.value}-${tick.label}`}
                  style={{ left: `${percentage(tick.value)}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {rows.map((row) => {
              const left = percentage(row.start)
              const right = percentage(row.end)
              const width = Math.max(right - left, 0)
              const selected = selectedRowId === row.id

              return (
                <div
                  className="grid min-h-[60px] grid-cols-[10rem_minmax(28rem,1fr)] items-center gap-3"
                  key={row.id}
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold">{row.label}</p>
                    {row.description && (
                      <p className="break-words text-xs text-ink-muted">
                        {row.description}
                      </p>
                    )}
                  </div>
                  <div className="relative h-10 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px)] bg-[size:25%_100%]">
                    <button
                      aria-label={`${row.label}: ${row.start} a ${row.end}`}
                      aria-pressed={selected}
                      className={`absolute top-1 min-h-8 min-w-8 rounded-control border px-2 text-left text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${toneClasses[row.tone ?? 'primary']} ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`.trim()}
                      onClick={() => onSelectRow?.(row)}
                      onKeyDown={(event) => activate(event, row)}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      type="button"
                    >
                      <span className="block truncate">{row.label}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <ul className="sr-only" data-testid="timeline-text-alternative">
        {rows.map((row) => (
          <li key={row.id}>
            {row.label}: {row.start} a {row.end}
            {row.description ? `; ${row.description}` : ''}
          </li>
        ))}
      </ul>
    </section>
  )
}

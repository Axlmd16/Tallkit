import React, { useId, useState } from 'react'

export interface DonutChartSegment {
  id?: string
  label: string
  value: number
  color?: string
}

export interface DonutChartProps {
  data: DonutChartSegment[]
  size?: number
  strokeWidth?: number
  centerLabel?: React.ReactNode
  centerValue?: React.ReactNode
  emptyMessage?: string
  ariaLabel?: string
  className?: string
  onSegmentClick?: (segment: DonutChartSegment) => void
}

const DEFAULT_COLORS = [
  '#605bff',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#3b82f6',
  '#14b8a6',
]

export function DonutChart({
  ariaLabel = 'Gráfico de dona',
  centerLabel,
  centerValue,
  className = '',
  data = [],
  emptyMessage = 'Sin datos disponibles',
  onSegmentClick,
  size = 200,
  strokeWidth = 24,
}: DonutChartProps) {
  const chartId = useId()
  const [activeSegment, setActiveSegment] = useState<DonutChartSegment | null>(
    null,
  )

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = data.reduce(
    (acc, curr) => acc + (curr.value > 0 ? curr.value : 0),
    0,
  )
  const isEmpty = data.length === 0
  const isZeroTotal = !isEmpty && total === 0

  let cumulativeOffset = 0

  const handleSelect = (seg: DonutChartSegment) => {
    setActiveSegment(seg)
    onSegmentClick?.(seg)
  }

  const displayedTotal =
    centerValue !== undefined
      ? centerValue
      : isZeroTotal
        ? '0'
        : total.toLocaleString('es-ES')

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center ${className}`}
      style={{ width: size, minHeight: size }}
    >
      <svg
        aria-label={ariaLabel}
        className="overflow-visible"
        height={size}
        role="group"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <title id={`${chartId}-title`}>{ariaLabel}</title>

        {/* Círculo base de pista */}
        <circle
          className="text-border/30 dark:text-border/40"
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />

        {/* Segmentos de datos */}
        {!isEmpty && !isZeroTotal && (
          <g>
            {data.map((seg, idx) => {
              const val = Math.max(seg.value, 0)
              if (val === 0) return null

              const pct = (val / total) * 100
              const dash = (val / total) * circumference
              const strokeDasharray = `${dash} ${circumference - dash}`
              const strokeDashoffset = -cumulativeOffset
              cumulativeOffset += dash

              const color =
                seg.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
              const isFocusedOrActive = activeSegment?.label === seg.label

              return (
                <circle
                  key={seg.id || `${seg.label}-${idx}`}
                  aria-label={`${seg.label}: ${seg.value} (${pct.toFixed(1)}%)`}
                  className="cursor-pointer transition-all duration-150 hover:opacity-85 focus:outline-none"
                  cx={size / 2}
                  cy={size / 2}
                  data-donut-segment="true"
                  fill="transparent"
                  onClick={() => handleSelect(seg)}
                  onFocus={() => setActiveSegment(seg)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelect(seg)
                    }
                  }}
                  r={radius}
                  role="button"
                  stroke={color}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeWidth={
                    isFocusedOrActive ? strokeWidth + 4 : strokeWidth
                  }
                  tabIndex={0}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              )
            })}
          </g>
        )}
      </svg>

      {/* Centro con métrica o mensaje */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
      >
        {isEmpty ? (
          <span className="text-xs font-medium text-ink-muted leading-tight">
            {emptyMessage}
          </span>
        ) : (
          <>
            <span className="text-2xl font-bold tracking-tight text-ink">
              {displayedTotal}
            </span>
            {centerLabel && (
              <span className="mt-0.5 text-xs font-medium text-ink-muted">
                {centerLabel}
              </span>
            )}
          </>
        )}
      </div>

      {/* Alternativa accesible textual para lectores de pantalla sin depender únicamente del color */}
      <div className="sr-only" data-testid="donut-text-alternative">
        {isEmpty ? (
          <p>{emptyMessage}</p>
        ) : isZeroTotal ? (
          <p>Total: 0. Todas las categorías en 0.</p>
        ) : (
          <ul>
            {data.map((seg, idx) => {
              const val = Math.max(seg.value, 0)
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
              return (
                <li key={seg.id || `${seg.label}-${idx}`}>
                  {seg.label}: {seg.value} ({pct}%)
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

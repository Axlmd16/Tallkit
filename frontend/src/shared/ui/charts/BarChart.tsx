import { useId, useState } from 'react'

export type BarChartOrientation = 'vertical' | 'horizontal'

export interface BarChartDataPoint {
  id?: string
  label: string
  value: number
  color?: string
}

export interface BarChartProps {
  data: BarChartDataPoint[]
  orientation?: BarChartOrientation
  height?: number
  ariaLabel?: string
  emptyMessage?: string
  className?: string
  onBarClick?: (point: BarChartDataPoint) => void
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

export function BarChart({
  ariaLabel = 'Gráfico de barras',
  className = '',
  data = [],
  emptyMessage = 'Sin datos disponibles',
  height,
  onBarClick,
  orientation = 'vertical',
}: BarChartProps) {
  const chartId = useId()
  const [activeBar, setActiveBar] = useState<BarChartDataPoint | null>(null)

  const isEmpty = data.length === 0

  if (isEmpty) {
    return (
      <div
        className={`flex min-h-[160px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border/40 p-6 text-center ${className}`}
      >
        <span className="text-xs font-medium text-ink-muted">
          {emptyMessage}
        </span>
      </div>
    )
  }

  const rawMax = Math.max(...data.map((d) => d.value), 0)
  const maxVal = rawMax === 0 ? 10 : rawMax * 1.15

  const handleSelect = (item: BarChartDataPoint) => {
    setActiveBar(item)
    onBarClick?.(item)
  }

  if (orientation === 'horizontal') {
    const width = 500
    const itemHeight = 36
    const padTop = 20
    const padBottom = 20
    const padLeft = 85
    const padRight = 50

    const svgHeight = height || data.length * itemHeight + padTop + padBottom
    const innerWidth = width - padLeft - padRight

    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <svg
          aria-label={ariaLabel}
          className="w-full overflow-visible"
          height={svgHeight}
          role="group"
          viewBox={`0 0 ${width} ${svgHeight}`}
        >
          <title id={`${chartId}-title`}>{ariaLabel}</title>

          {/* Rejilla vertical sutil */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const x = padLeft + pct * innerWidth
            return (
              <line
                key={`grid-x-${idx}`}
                stroke="currentColor"
                strokeDasharray="3 3"
                strokeWidth="1"
                className="text-border/20 dark:text-border/25"
                x1={x}
                x2={x}
                y1={padTop}
                y2={svgHeight - padBottom}
              />
            )
          })}

          {/* Barras horizontales */}
          {data.map((item, idx) => {
            const y = padTop + idx * itemHeight + 6
            const barThickness = 18
            const val = Math.max(item.value, 0)
            const barLength = maxVal > 0 ? (val / maxVal) * innerWidth : 0
            const color =
              item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
            const isFocused = activeBar?.label === item.label

            return (
              <g key={item.id || `${item.label}-${idx}`}>
                {/* Etiqueta de categoría en Y */}
                <text
                  alignmentBaseline="middle"
                  className="fill-ink-muted text-[11px] font-medium"
                  textAnchor="end"
                  x={padLeft - 10}
                  y={y + barThickness / 2}
                >
                  {item.label}
                </text>

                {/* Barra de fondo sutil */}
                <rect
                  className="fill-surface-subtle/50 dark:fill-surface-subtle/30"
                  height={barThickness}
                  rx="3"
                  ry="3"
                  width={innerWidth}
                  x={padLeft}
                  y={y}
                />

                {/* Barra de valor */}
                <rect
                  aria-label={`${item.label}: ${item.value}`}
                  className="cursor-pointer transition-all duration-200 hover:opacity-85 focus:outline-none"
                  data-bar-item="true"
                  fill={color}
                  height={barThickness}
                  onClick={() => handleSelect(item)}
                  onFocus={() => setActiveBar(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelect(item)
                    }
                  }}
                  role="button"
                  rx="3"
                  ry="3"
                  stroke={isFocused ? 'var(--ink, #0f172a)' : 'transparent'}
                  strokeWidth={isFocused ? 2 : 0}
                  tabIndex={0}
                  width={barLength}
                  x={padLeft}
                  y={y}
                />

                {/* Valor numérico al final de la barra */}
                <text
                  alignmentBaseline="middle"
                  className="fill-ink text-[11px] font-semibold"
                  textAnchor="start"
                  x={padLeft + barLength + 8}
                  y={y + barThickness / 2}
                >
                  {item.value}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Alternativa textual para lectores de pantalla */}
        <div className="sr-only" data-testid="barchart-text-alternative">
          <ul>
            {data.map((item, idx) => (
              <li key={item.id || `${item.label}-${idx}`}>
                {item.label}: {item.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // Orientación vertical por defecto
  const width = 500
  const svgHeight = height || 240
  const padTop = 20
  const padBottom = 40
  const padLeft = 40
  const padRight = 20

  const innerWidth = width - padLeft - padRight
  const innerHeight = svgHeight - padTop - padBottom
  const step = innerWidth / data.length
  const barWidth = Math.min(step * 0.55, 42)

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <svg
        aria-label={ariaLabel}
        className="w-full overflow-visible"
        height={svgHeight}
        role="group"
        viewBox={`0 0 ${width} ${svgHeight}`}
      >
        <title id={`${chartId}-title`}>{ariaLabel}</title>

        {/* Rejilla horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const y = padTop + pct * innerHeight
          const valLabel = Math.round(maxVal * (1 - pct))
          return (
            <g key={`grid-y-${idx}`}>
              <line
                stroke="currentColor"
                strokeDasharray="3 3"
                strokeWidth="1"
                className="text-border/20 dark:text-border/25"
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
              />
              <text
                alignmentBaseline="middle"
                className="fill-ink-muted text-[10px] select-none"
                textAnchor="end"
                x={padLeft - 8}
                y={y}
              >
                {valLabel}
              </text>
            </g>
          )
        })}

        {/* Barras verticales */}
        {data.map((item, idx) => {
          const val = Math.max(item.value, 0)
          const barHeight = maxVal > 0 ? (val / maxVal) * innerHeight : 0
          const x = padLeft + idx * step + (step - barWidth) / 2
          const y = padTop + innerHeight - barHeight
          const color =
            item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
          const isFocused = activeBar?.label === item.label

          return (
            <g key={item.id || `${item.label}-${idx}`}>
              {/* Barra de valor */}
              <rect
                aria-label={`${item.label}: ${item.value}`}
                className="cursor-pointer transition-all duration-200 hover:opacity-85 focus:outline-none"
                data-bar-item="true"
                fill={color}
                height={barHeight}
                onClick={() => handleSelect(item)}
                onFocus={() => setActiveBar(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelect(item)
                  }
                }}
                role="button"
                rx="3"
                ry="3"
                stroke={isFocused ? 'var(--ink, #0f172a)' : 'transparent'}
                strokeWidth={isFocused ? 2 : 0}
                tabIndex={0}
                width={barWidth}
                x={x}
                y={y}
              />

              {/* Etiqueta de categoría en eje X */}
              <text
                className="fill-ink-muted text-[11px] font-medium"
                textAnchor="middle"
                x={x + barWidth / 2}
                y={svgHeight - 14}
              >
                {item.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Alternativa textual accesible para lectores de pantalla */}
      <div className="sr-only" data-testid="barchart-text-alternative">
        <ul>
          {data.map((item, idx) => (
            <li key={item.id || `${item.label}-${idx}`}>
              {item.label}: {item.value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

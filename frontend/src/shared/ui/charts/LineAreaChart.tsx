import { useId, useState } from 'react'

export interface LineChartDataPoint {
  label: string
  value: number | null
}

export interface LineAreaChartProps {
  data: LineChartDataPoint[]
  color?: string | undefined
  showArea?: boolean | undefined
  height?: number | undefined
  ariaLabel?: string | undefined
  className?: string | undefined
}

export function LineAreaChart({
  ariaLabel = 'Gráfico de líneas',
  className = '',
  color = '#605bff',
  data,
  height = 240,
  showArea = false,
}: LineAreaChartProps) {
  const gradientId = useId()
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null)

  const width = 600
  const padTop = 20
  const padRight = 30
  const padBottom = 40
  const padLeft = 40

  const innerWidth = width - padLeft - padRight
  const innerHeight = height - padTop - padBottom

  const validValues = data
    .map((d) => d.value)
    .filter((v): v is number => v !== null && !Number.isNaN(v))

  const minVal = 0
  const rawMax = validValues.length > 0 ? Math.max(...validValues) : 10
  const maxVal = rawMax === 0 ? 10 : rawMax * 1.15

  const getX = (index: number): number => {
    if (data.length <= 1) {
      return padLeft + innerWidth / 2
    }
    return padLeft + (index / (data.length - 1)) * innerWidth
  }

  const getY = (val: number): number => {
    const range = maxVal - minVal || 1
    const normalized = (val - minVal) / range
    return padTop + innerHeight - normalized * innerHeight
  }

  // Agrupar en tramos continuos de valores no nulos
  const segments: Array<
    Array<{ index: number; x: number; y: number; label: string; value: number }>
  > = []
  let currentSegment: Array<{
    index: number
    x: number
    y: number
    label: string
    value: number
  }> = []

  data.forEach((item, index) => {
    if (item.value !== null && !Number.isNaN(item.value)) {
      currentSegment.push({
        index,
        label: item.label,
        value: item.value,
        x: getX(index),
        y: getY(item.value),
      })
    } else {
      if (currentSegment.length > 0) {
        segments.push(currentSegment)
        currentSegment = []
      }
    }
  })
  if (currentSegment.length > 0) {
    segments.push(currentSegment)
  }

  // Generar path de línea
  let linePathD = ''
  let areaPathD = ''

  segments.forEach((seg) => {
    if (seg.length === 1) {
      const pt = seg[0]!
      linePathD += `M ${pt.x - 10} ${pt.y} L ${pt.x + 10} ${pt.y} `
      areaPathD += `M ${pt.x - 10} ${padTop + innerHeight} L ${pt.x - 10} ${pt.y} L ${pt.x + 10} ${pt.y} L ${pt.x + 10} ${padTop + innerHeight} Z `
    } else if (seg.length > 1) {
      const first = seg[0]!
      let segLine = `M ${first.x} ${first.y} `
      let segArea = `M ${first.x} ${padTop + innerHeight} L ${first.x} ${first.y} `

      for (let i = 1; i < seg.length; i++) {
        const pt = seg[i]!
        segLine += `L ${pt.x} ${pt.y} `
        segArea += `L ${pt.x} ${pt.y} `
      }

      const last = seg[seg.length - 1]!
      segArea += `L ${last.x} ${padTop + innerHeight} Z `

      linePathD += segLine
      areaPathD += segArea
    }
  })

  // Rejilla de 4 niveles
  const gridTicks = [0, 0.33, 0.66, 1]
  const zeroY = padTop + innerHeight

  return (
    <div className={`relative w-full text-ink select-none ${className}`.trim()}>
      <svg
        aria-label={ariaLabel}
        className="w-full h-auto overflow-visible"
        role="group"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {/* Líneas de rejilla */}
        <g className="chart-grid">
          {gridTicks.map((ratio) => {
            const y = padTop + innerHeight * (1 - ratio)
            const tickVal = Math.round(minVal + ratio * (maxVal - minVal))
            return (
              <g key={ratio}>
                <line
                  className="chart-grid-line text-border-subtle"
                  opacity={0.6}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                />
                <text
                  className="fill-ink-muted text-[10px] font-mono select-none"
                  dominantBaseline="middle"
                  textAnchor="end"
                  x={padLeft - 8}
                  y={y}
                >
                  {tickVal}
                </text>
              </g>
            )
          })}
        </g>

        {/* Eje X (etiquetas de puntos) */}
        <g className="chart-x-axis">
          {data.map((item, idx) => {
            const x = getX(idx)
            return (
              <text
                className="fill-ink-muted text-[11px] select-none"
                dominantBaseline="hanging"
                key={item.label + idx}
                textAnchor="middle"
                x={x}
                y={zeroY + 8}
              >
                {item.label}
              </text>
            )
          })}
        </g>

        {/* Relleno de área */}
        {showArea && areaPathD && (
          <path
            className="chart-area-path transition-all duration-200"
            d={areaPathD.trim()}
            fill={`url(#${gradientId})`}
          />
        )}

        {/* Línea principal */}
        {linePathD && (
          <path
            className="chart-line-path"
            d={linePathD.trim()}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
          />
        )}

        {/* Puntos interactivos */}
        <g className="chart-points">
          {segments.flatMap((seg) =>
            seg.map((pt) => {
              const isHovered = activePointIndex === pt.index
              return (
                <g
                  aria-label={`${pt.label}: ${pt.value}`}
                  className="cursor-pointer outline-none focus:outline-none"
                  key={pt.index}
                  onBlur={() => setActivePointIndex(null)}
                  onFocus={() => setActivePointIndex(pt.index)}
                  onMouseEnter={() => setActivePointIndex(pt.index)}
                  onMouseLeave={() => setActivePointIndex(null)}
                  role="button"
                  tabIndex={0}
                >
                  <circle
                    className="transition-transform duration-150"
                    cx={pt.x}
                    cy={pt.y}
                    fill="white"
                    r={isHovered ? 6 : 4}
                    stroke={color}
                    strokeWidth={isHovered ? 3 : 2}
                  />
                  {/* Área táctil invisible de 24x24px */}
                  <circle cx={pt.x} cy={pt.y} fill="transparent" r={14} />
                </g>
              )
            }),
          )}
        </g>
      </svg>

      {/* Tooltip dinámico al hacer foco o hover */}
      {activePointIndex !== null && data[activePointIndex] && (
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-full px-2.5 py-1 bg-ink text-surface text-xs font-semibold rounded-group shadow-overlay pointer-events-none transition-all duration-75"
          role="tooltip"
          style={{
            left: `${(getX(activePointIndex) / width) * 100}%`,
            top: `${(getY(data[activePointIndex].value ?? 0) / height) * 100}%`,
            marginTop: '-8px',
          }}
        >
          {data[activePointIndex].label}: {data[activePointIndex].value}
        </div>
      )}
    </div>
  )
}

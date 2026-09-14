import React, { useId } from 'react'

export type ProgressVariant = 'linear' | 'circular'
export type ProgressTone =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
export type ProgressSize = 'sm' | 'md' | 'lg'

export interface ProgressProps {
  value?: number
  max?: number
  variant?: ProgressVariant
  size?: ProgressSize
  tone?: ProgressTone
  label?: React.ReactNode
  showValue?: boolean
  formatValue?: (value: number, max: number) => string
  indeterminate?: boolean
  className?: string
  ariaLabel?: string
}

const toneLinearClassMap: Record<ProgressTone, string> = {
  default: 'bg-ink',
  primary: 'bg-primary',
  success: 'bg-emerald-600 dark:bg-emerald-500',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-rose-600 dark:bg-rose-500',
}

const toneCircularColorMap: Record<ProgressTone, string> = {
  default: 'currentColor',
  primary: 'var(--primary, #605bff)',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
}

const linearHeightMap: Record<ProgressSize, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

const circularDimensionsMap: Record<
  ProgressSize,
  { size: number; stroke: number }
> = {
  sm: { size: 36, stroke: 3 },
  md: { size: 48, stroke: 4 },
  lg: { size: 64, stroke: 6 },
}

export function Progress({
  ariaLabel,
  className = '',
  formatValue,
  indeterminate = false,
  label,
  max = 100,
  showValue = false,
  size = 'md',
  tone = 'primary',
  value = 0,
  variant = 'linear',
}: ProgressProps) {
  const labelId = useId()
  const clampedValue = Math.min(Math.max(value, 0), max)
  const percentage = max > 0 ? (clampedValue / max) * 100 : 0

  const resolvedLabel =
    ariaLabel || (typeof label === 'string' ? label : undefined) || 'Progreso'
  const formattedValue = formatValue
    ? formatValue(clampedValue, max)
    : `${Math.round(percentage)}%`

  if (variant === 'circular') {
    const { size: svgSize, stroke } = circularDimensionsMap[size]
    const radius = (svgSize - stroke) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference
    const color = toneCircularColorMap[tone]

    return (
      <div
        aria-busy={indeterminate ? 'true' : undefined}
        aria-label={resolvedLabel}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={indeterminate ? undefined : Math.round(clampedValue)}
        className={`inline-flex flex-col items-center gap-1.5 ${className}`}
        role="progressbar"
      >
        <div
          className="relative inline-flex items-center justify-center"
          style={{ width: svgSize, height: svgSize }}
        >
          <svg
            className={`overflow-visible ${indeterminate ? 'animate-spin' : ''}`}
            height={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            width={svgSize}
          >
            {/* Pista de fondo */}
            <circle
              className="text-border/30 dark:text-border/40"
              cx={svgSize / 2}
              cy={svgSize / 2}
              fill="transparent"
              r={radius}
              stroke="currentColor"
              strokeWidth={stroke}
            />

            {/* Círculo de valor */}
            {!indeterminate && (
              <circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                fill="transparent"
                r={radius}
                stroke={color}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth={stroke}
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
              />
            )}

            {indeterminate && (
              <circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                fill="transparent"
                r={radius}
                stroke={color}
                strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
                strokeLinecap="round"
                strokeWidth={stroke}
                transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
              />
            )}
          </svg>

          {showValue && !indeterminate && (
            <span className="absolute text-[11px] font-semibold text-ink">
              {formattedValue}
            </span>
          )}
        </div>

        {label && (
          <span className="text-xs font-medium text-ink-muted">{label}</span>
        )}
      </div>
    )
  }

  return (
    <div
      aria-busy={indeterminate ? 'true' : undefined}
      aria-label={resolvedLabel}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={indeterminate ? undefined : Math.round(clampedValue)}
      className={`w-full flex flex-col gap-1.5 ${className}`}
      role="progressbar"
    >
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
          {label && <span id={labelId}>{label}</span>}
          {showValue && !indeterminate && <span>{formattedValue}</span>}
        </div>
      )}

      {/* Pista lineal */}
      <div
        className={`w-full overflow-hidden rounded-full bg-border/30 dark:bg-border/40 ${linearHeightMap[size]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${toneLinearClassMap[tone]} ${
            indeterminate ? 'w-1/3 animate-pulse' : ''
          }`}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

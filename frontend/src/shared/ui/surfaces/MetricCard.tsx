import type { ReactNode } from 'react'

export type MetricCardAccent = 'primary' | 'success' | 'warning' | 'info'
export type MetricCardSize = 'standard' | 'compact'

export interface MetricCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  detail?: ReactNode
  accent?: MetricCardAccent
  size?: MetricCardSize
  className?: string
}

const accentClasses: Record<MetricCardAccent, string> = {
  info: 'bg-surface-selected text-ink',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
}

export function MetricCard({
  label,
  value,
  icon,
  detail,
  accent = 'primary',
  size = 'standard',
  className = '',
}: MetricCardProps) {
  const isCompact = size === 'compact'
  const cardSizeClass = isCompact
    ? 'min-h-24 px-5 py-4 gap-4'
    : 'min-h-[116px] px-6 py-5 gap-5'
  const iconSizeClass = isCompact ? 'size-12' : 'size-[60px]'
  const valueSizeClass = isCompact ? 'text-2xl' : 'text-[22px]'

  return (
    <article
      className={`flex items-center rounded-group bg-surface ${cardSizeClass} ${className}`.trim()}
    >
      {icon && (
        <span
          className={`grid shrink-0 place-items-center rounded-full ${iconSizeClass} ${accentClasses[accent]}`}
        >
          {icon}
        </span>
      )}

      <div className="min-w-0">
        <p
          className={`numeric font-extrabold leading-tight text-ink ${valueSizeClass}`}
        >
          {value}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-ink-muted">{label}</p>
        {detail && <div className="mt-1 text-xs text-ink-muted">{detail}</div>}
      </div>
    </article>
  )
}

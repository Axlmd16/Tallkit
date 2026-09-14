import type { ReactNode } from 'react'

import { Surface } from './index'

export interface DetailCardMetadataItem {
  label: string
  value: ReactNode
}

export interface DetailCardProps {
  title: string
  subtitle?: string
  badge?: ReactNode
  actions?: ReactNode
  media?: ReactNode
  metadata?: DetailCardMetadataItem[]
  children?: ReactNode
  className?: string
}

export function DetailCard({
  title,
  subtitle,
  badge,
  actions,
  media,
  metadata,
  children,
  className = '',
}: DetailCardProps) {
  return (
    <Surface className={`flex flex-col gap-4 ${className}`.trim()}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-lg font-bold leading-snug text-ink">{title}</h3>
            {badge && <span className="shrink-0">{badge}</span>}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
          )}
        </div>

        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {media && <div className="w-full">{media}</div>}

      {metadata && metadata.length > 0 && (
        <div className="grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {metadata.map((item, idx) => (
            <div className="min-w-0" key={`${item.label}-${idx}`}>
              <span className="block text-xs font-semibold text-ink-muted">
                {item.label}
              </span>
              <span className="mt-0.5 block break-words text-sm font-medium text-ink">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {children && (
        <div className="text-sm text-ink break-words">{children}</div>
      )}
    </Surface>
  )
}

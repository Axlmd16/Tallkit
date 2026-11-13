import type { ReactNode } from 'react'

import { GaugeMotif } from '../brand'
import { Surface } from './index'

export interface DetailCardMetadataItem {
  label: string
  value: ReactNode
}

export interface DetailCardProps {
  title: ReactNode
  subtitle?: string
  icon?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  media?: ReactNode
  metadata?: DetailCardMetadataItem[]
  children?: ReactNode
  className?: string
  /** `dark`: tarjeta grafito con el tacómetro de fondo, para el encabezado de un vehículo. */
  variant?: 'light' | 'dark'
}

export function DetailCard({
  title,
  subtitle,
  icon,
  badge,
  actions,
  media,
  metadata,
  children,
  className = '',
  variant = 'light',
}: DetailCardProps) {
  const dark = variant === 'dark'
  return (
    <Surface
      className={`relative flex flex-col gap-4 overflow-hidden ${dark ? 'border-graphite-line! bg-graphite! text-white' : ''} ${className}`.trim()}
      data-variant={variant}
    >
      {dark && (
        <GaugeMotif
          className="absolute -right-4 -bottom-4 h-28 w-48"
          variant="card"
        />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex items-center gap-3">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3
                className={`text-lead font-semibold leading-snug ${dark ? 'text-white' : 'text-ink'}`}
              >
                {title}
              </h3>
              {badge && <span className="shrink-0">{badge}</span>}
            </div>
            {subtitle && (
              <p
                className={`mt-0.5 text-body ${dark ? 'text-graphite-ink' : 'text-ink-muted'}`}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {media && <div className="w-full">{media}</div>}

      {metadata && metadata.length > 0 && (
        <div
          className={`relative grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3 ${dark ? 'border-graphite-line' : 'border-line'}`}
        >
          {metadata.map((item, idx) => (
            <div className="min-w-0" key={`${item.label}-${idx}`}>
              <span
                className={`block text-label font-semibold ${dark ? 'text-graphite-ink' : 'text-ink-muted'}`}
              >
                {item.label}
              </span>
              <span
                className={`mt-0.5 block break-words text-body font-medium ${dark ? 'text-white' : 'text-ink'}`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {children && (
        <div
          className={`relative text-body break-words ${dark ? 'text-white' : 'text-ink'}`}
        >
          {children}
        </div>
      )}
    </Surface>
  )
}

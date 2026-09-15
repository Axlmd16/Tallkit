import type { ReactNode } from 'react'

export interface ConfigurationMapItem {
  href: string
  label: string
  description: string
  count: ReactNode
  icon: ReactNode
  tone: 'primary' | 'info' | 'warning' | 'success'
}

export interface ConfigurationMapProps {
  items: ConfigurationMapItem[]
}

const toneClasses: Record<ConfigurationMapItem['tone'], string> = {
  primary: 'bg-primary-soft text-primary',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
}

export function ConfigurationMap({ items }: ConfigurationMapProps) {
  return (
    <section className="rounded-group bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">Mapa de configuración</h2>
          <p className="mt-1 max-w-[62ch] text-sm text-ink-muted">
            Acceda directamente a los parámetros que mantienen operativo el
            taller.
          </p>
        </div>
        <span className="text-xs font-semibold text-ink-muted">
          4 áreas bajo control
        </span>
      </div>

      <nav
        aria-label="Mapa de configuración"
        className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {items.map((item) => (
          <a
            className="group flex min-h-[88px] items-center gap-3 rounded-control border border-line bg-surface-muted/45 px-3.5 py-3 transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-primary/25 hover:bg-primary-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href={item.href}
            key={item.href}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${toneClasses[item.tone]}`}
            >
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-ink">
                  {item.label}
                </span>
                <span className="shrink-0 text-sm font-extrabold text-ink">
                  {item.count}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-ink-muted">
                {item.description}
              </span>
            </span>
          </a>
        ))}
      </nav>
    </section>
  )
}

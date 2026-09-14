import type { ReactNode } from 'react'

export interface DashboardLayoutProps {
  children: ReactNode
  metrics?: ReactNode
  sidePanel?: ReactNode
  className?: string
  contentClassName?: string
}

export function DashboardLayout({
  children,
  metrics,
  sidePanel,
  className = '',
  contentClassName = '',
}: DashboardLayoutProps) {
  return (
    <div className={`flex flex-col gap-6 w-full ${className}`.trim()}>
      {metrics && (
        <section aria-label="Métricas clave" className="w-full" role="region">
          {metrics}
        </section>
      )}

      {sidePanel ? (
        <div className="grid grid-cols-1 gap-6 w-full lg:grid-cols-3">
          <div
            className={`flex flex-col gap-6 lg:col-span-2 ${contentClassName}`.trim()}
          >
            {children}
          </div>
          <div className="flex flex-col gap-6 lg:col-span-1">{sidePanel}</div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-6 w-full md:grid-cols-2 ${contentClassName}`.trim()}
        >
          {children}
        </div>
      )}
    </div>
  )
}

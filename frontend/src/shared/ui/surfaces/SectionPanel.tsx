import type { ReactNode } from 'react'

/**
 * Panel de sección de fichas y formularios: cabecera sobre `surface-subtle` con ícono, título,
 * descripción opcional y acciones, separada del cuerpo blanco para que cada sección se
 * distinga del lienzo de la página.
 */
export function SectionPanel({
  id,
  title,
  description,
  icon,
  actions,
  children,
  className = '',
}: {
  id: string
  title: string
  description?: string | undefined
  icon: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-labelledby={id}
      className={`overflow-hidden rounded-panel border border-line bg-surface ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-control bg-surface text-accent ring-1 ring-line"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-[14.5px] font-semibold text-ink" id={id}>
              {title}
            </h2>
            {description && (
              <p className="text-xs text-ink-muted">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

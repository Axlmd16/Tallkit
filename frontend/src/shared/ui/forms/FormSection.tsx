import { useId, type ReactNode } from 'react'

import { FormLayout } from '@/shared/ui/layout'

export interface FormSectionProps {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Grupo de campos con cabecera (icono, título y descripción) y rejilla de dos
 * columnas. Un campo que deba ocupar toda la fila usa `sm:col-span-2`.
 */
export function FormSection({
  title,
  description,
  icon,
  children,
  className = '',
}: FormSectionProps) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={`rounded-group border border-line bg-surface-subtle/60 p-4 sm:p-5 ${className}`.trim()}
      role="group"
    >
      <header className="mb-4 flex items-start gap-3">
        {icon && (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-group bg-primary-soft text-primary"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink" id={titleId}>
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
          )}
        </div>
      </header>
      <FormLayout columns={2}>{children}</FormLayout>
    </section>
  )
}

/** Coloca un icono decorativo a la izquierda de un `Input` (que debe llevar `pl-11`). */
export function LeadingIcon({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
      >
        {icon}
      </span>
      {children}
    </div>
  )
}

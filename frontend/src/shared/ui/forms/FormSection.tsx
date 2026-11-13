import { useId, type ReactNode } from 'react'

import { FormLayout } from '@/shared/ui/layout'

export interface FormSectionProps {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  /** `flush`: sección dentro de un panel común, separada por una línea. */
  variant?: 'card' | 'flush'
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
  variant = 'card',
}: FormSectionProps) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={`form-section grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-7 ${variant === 'flush' ? 'border-b border-line last:border-b-0' : 'rounded-panel border border-line bg-surface'} ${className}`.trim()}
      role="group"
    >
      <header className="flex min-w-0 items-start gap-2">
        {icon && (
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-ink" id={titleId}>
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-label leading-[18px] text-ink-muted">
              {description}
            </p>
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
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
      >
        {icon}
      </span>
      {children}
    </div>
  )
}

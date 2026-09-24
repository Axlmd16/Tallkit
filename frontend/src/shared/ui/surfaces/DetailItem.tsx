import type { ReactNode } from 'react'

/** Dato de una ficha: ícono en recuadro, etiqueta pequeña y valor. Va dentro de un `<dl>`. */
export function DetailItem({
  icon,
  label,
  children,
  className = '',
}: {
  icon: ReactNode
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex min-w-0 gap-2.5 ${className}`}>
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-control bg-surface-subtle text-accent"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className="mt-0.5 text-[13px] font-medium break-words text-ink">
          {children}
        </dd>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

/** Filas de consulta etiqueta–valor separadas por líneas finas, sin tarjetas. */
export function FactList({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <dl className={`border-b border-line ${className}`}>{children}</dl>
}

export function FactRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1 border-t border-line py-3.5 text-sm leading-[1.45] sm:grid-cols-[11.25rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  )
}

import { Storefront, Wrench } from '@phosphor-icons/react'

export type ScopeLabelScope = 'commercial' | 'artesanal'

const scopes = {
  commercial: {
    label: 'Comercial',
    Icon: Storefront,
    className: 'text-scope-commercial',
  },
  artesanal: {
    label: 'Artesanal',
    Icon: Wrench,
    className: 'text-scope-artisan',
  },
} as const

/** Rótulo de ámbito fiscal para encabezar fichas y grupos: nombre, icono y tono propios. */
export function ScopeLabel({
  scope,
  className = '',
}: {
  scope: ScopeLabelScope
  className?: string
}) {
  const { label, Icon, className: tone } = scopes[scope]
  return (
    <span
      className={`inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase ${tone} ${className}`}
    >
      <Icon aria-hidden="true" size={14} weight="bold" />
      {label}
    </span>
  )
}

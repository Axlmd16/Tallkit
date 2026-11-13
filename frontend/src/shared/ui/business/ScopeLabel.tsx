import { BusinessMark } from './BusinessMark'

export type ScopeLabelScope = 'commercial' | 'artesanal'

const scopes = {
  commercial: {
    label: 'Comercial',
    className: 'text-scope-commercial-ink',
  },
  artesanal: {
    label: 'Artesanal',
    className: 'text-scope-artisan-ink',
  },
} as const

/** Rótulo de ámbito fiscal para encabezar fichas y grupos: nombre, icono y tono propios. */
export function ScopeLabel({
  scope,
  className = '',
  name,
  logoUrl,
}: {
  scope: ScopeLabelScope
  className?: string
  /** Nombre comercial de la entidad, para las iniciales de su marca. */
  name?: string
  logoUrl?: string | null
}) {
  const { label, className: tone } = scopes[scope]
  return (
    <span
      className={`inline-flex items-center gap-2 text-micro font-semibold tracking-wider uppercase ${tone} ${className}`}
    >
      <BusinessMark
        decorative
        logoUrl={logoUrl}
        name={name ?? label}
        scope={scope}
        size="sm"
      />
      {label}
    </span>
  )
}

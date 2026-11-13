import type { ScopeLabelScope } from './ScopeLabel'

export type BusinessMarkSize = 'sm' | 'md' | 'lg'

export interface BusinessMarkProps {
  /** Nombre de la entidad fiscal: da las iniciales y es el nombre accesible. */
  name: string
  scope: ScopeLabelScope
  /** Logotipo configurado de la entidad; sin él se muestran las iniciales. */
  logoUrl?: string | null | undefined
  size?: BusinessMarkSize
  /** Cuando el nombre ya está escrito al lado, la marca no se anuncia dos veces. */
  decorative?: boolean
  className?: string
}

const LINKS = new Set(['y', 'e', 'de', 'del', 'la', 'las', 'el', 'los', 'en'])

/**
 * Iniciales de la marca: la primera letra de la primera y de la última palabra significativa.
 * Así «Transmisiones y Embragues Jimenez» (TJ) y «Transmisiones y Embragues Jimenez Repuestos
 * Automotrices» (TA) no se confunden aunque empiecen igual.
 */
export function businessInitials(name: string) {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word && !LINKS.has(word.toLowerCase()))
  const [first] = words
  if (!first) return '?'
  const last = words[words.length - 1] ?? first
  const letters = words.length > 1 ? `${first[0]}${last[0]}` : first.slice(0, 2)
  return letters.toLocaleUpperCase('es')
}

const shapes: Record<ScopeLabelScope, string> = {
  /** Entidad artesanal: círculo en pizarra. */
  artesanal: 'rounded-full bg-scope-artisan',
  /** Entidad comercial: cuadrado redondeado en arena. */
  commercial: 'rounded-control bg-scope-commercial',
}

const sizes: Record<BusinessMarkSize, string> = {
  sm: 'size-6 text-micro',
  md: 'size-8 text-label',
  lg: 'size-11 text-block',
}

/** Logotipo configurado de una entidad fiscal o, sin él, sus iniciales con su forma y su tono. */
export function BusinessMark({
  name,
  scope,
  logoUrl,
  size = 'md',
  decorative = false,
  className = '',
}: BusinessMarkProps) {
  const shape = shapes[scope]
  const base = `inline-grid shrink-0 place-items-center overflow-hidden font-bold tracking-wide text-white ${sizes[size]} ${className}`
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': name } as const)

  if (logoUrl) {
    return (
      <span
        className={`${base} ${shape.split(' ')[0]} border border-line bg-white`}
        data-scope={scope}
        {...a11y}
      >
        <img alt="" className="size-full object-contain p-0.5" src={logoUrl} />
      </span>
    )
  }
  return (
    <span className={`${base} ${shape}`} data-scope={scope} {...a11y}>
      {businessInitials(name)}
    </span>
  )
}

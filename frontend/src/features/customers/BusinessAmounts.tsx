import { useIssuerBrand, type IssuerScope } from '@/shared/api/entity-logos'
import { BusinessMark, Money } from '@/shared/ui'

function Amount({
  scope,
  amount,
  className,
}: {
  scope: IssuerScope
  amount: string
  className: string
}) {
  const brand = useIssuerBrand(scope)
  const name =
    brand.displayName ?? (scope === 'COMERCIAL' ? 'Repuestos' : 'Servicios')
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <BusinessMark
        logoUrl={brand.logoUrl}
        name={name}
        scope={scope === 'COMERCIAL' ? 'commercial' : 'artesanal'}
        size="sm"
      />
      <Money amount={amount} />
    </span>
  )
}

/**
 * Un importe por negocio, cada uno con su marca. Nunca los suma: si el diseño pide un solo
 * número, aquí van dos. Un negocio sin dato (`null`) no se muestra.
 */
export function BusinessAmounts({
  artisan,
  commercial,
  className = '',
  layout = 'stack',
  empty = '—',
}: {
  artisan: string | null | undefined
  commercial: string | null | undefined
  className?: string
  layout?: 'stack' | 'inline'
  empty?: string
}) {
  if (artisan == null && commercial == null)
    return <span className="text-ink-muted">{empty}</span>
  return (
    <span
      className={`flex ${layout === 'stack' ? 'flex-col items-start gap-1' : 'flex-wrap items-center gap-x-3 gap-y-1'}`}
    >
      {artisan != null && (
        <Amount amount={artisan} className={className} scope="ARTESANAL" />
      )}
      {commercial != null && (
        <Amount amount={commercial} className={className} scope="COMERCIAL" />
      )}
    </span>
  )
}

/** Deja solo los saldos mayores que cero; un saldo en cero no es deuda. */
export function owed(value: string | null | undefined): string | null {
  return value != null && Number(value) > 0 ? value : null
}

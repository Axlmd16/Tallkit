import { useIssuerBrand, type IssuerScope } from '@/shared/api/entity-logos'
import { BusinessMark, formatMoney } from '@/shared/ui'

import type { OrderBilling, OrderBillingEntry } from './types'

const tone: Record<OrderBillingEntry['state'], string> = {
  PAID: 'text-success',
  PARTIAL: 'text-danger',
  PENDING: 'text-danger',
  UNDOCUMENTED: 'text-ink-muted',
}

function label(entry: OrderBillingEntry): string {
  if (entry.state === 'PAID') return 'Pagado'
  if (entry.state === 'UNDOCUMENTED') return 'Sin cobrar'
  return `Debe ${formatMoney(entry.balance) ?? entry.balance}`
}

function Row({
  scope,
  entry,
}: {
  scope: IssuerScope
  entry: OrderBillingEntry
}) {
  const brand = useIssuerBrand(scope)
  const name =
    brand.displayName ?? (scope === 'COMERCIAL' ? 'Repuestos' : 'Servicios')
  return (
    <span className="flex items-center gap-2 text-label">
      <BusinessMark
        logoUrl={brand.logoUrl}
        name={name}
        scope={scope === 'COMERCIAL' ? 'commercial' : 'artesanal'}
        size="sm"
      />
      <span
        className={`inline-flex items-center gap-1.5 font-semibold ${tone[entry.state]} before:size-1.5 before:rounded-full before:bg-current before:content-['']`}
      >
        {label(entry)}
      </span>
    </span>
  )
}

/**
 * Cobro de una orden, una fila por negocio con su marca y su propio saldo. Nunca suma los dos
 * negocios. Sin datos de cobro (el negocio no tiene nada en la orden) no muestra la fila.
 */
export function BillingCell({
  billing,
}: {
  billing: OrderBilling | undefined
}) {
  if (!billing || (!billing.artisan && !billing.commercial))
    return <span className="text-label text-ink-muted">Sin trabajos</span>
  return (
    <span className="flex flex-col gap-1">
      {billing.artisan && <Row entry={billing.artisan} scope="ARTESANAL" />}
      {billing.commercial && (
        <Row entry={billing.commercial} scope="COMERCIAL" />
      )}
    </span>
  )
}

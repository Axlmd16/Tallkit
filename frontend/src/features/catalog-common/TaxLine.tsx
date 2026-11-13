import { FiscalScopeBadge, InlineNotice } from '@/shared/ui'

/** Proyección mínima del impuesto que entregan los catálogos de productos y servicios. */
export interface TaxSummary {
  code: string
  name: string
  rate: string | null
  tax_status: 'applicable' | 'missing' | 'ambiguous'
}

/** Ámbito fiscal e impuesto incluido en un precio final; advierte si no puede aplicarse. */
export function TaxLine({
  tax,
  scope,
}: {
  tax: TaxSummary | null
  scope: 'commercial' | 'artesanal'
}) {
  const rate =
    tax?.tax_status === 'applicable' && tax.rate !== null
      ? tax.rate.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
      : null
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-label text-ink-muted">
        <FiscalScopeBadge scope={scope} />
        <span>
          {tax
            ? `${tax.code} · ${tax.name}${rate ? ` ${rate} % incluido` : ''}`
            : 'Sin impuesto asignado'}
        </span>
      </div>
      {tax && tax.tax_status !== 'applicable' && (
        <InlineNotice
          title={
            tax.tax_status === 'missing'
              ? 'Vigencia del impuesto pendiente'
              : 'Vigencias del impuesto ambiguas'
          }
          tone="warning"
        >
          Revise la configuración del impuesto antes de usarlo en una venta.
        </InlineNotice>
      )}
    </div>
  )
}

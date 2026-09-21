import { Printer } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useSaleDocument } from '@/features/sales/hooks'
import { SalesDocument, type SheetData } from '@/features/sales/SalesDocument'
import { saleStateLabels } from '@/features/sales/types'
import { Button, InlineNotice, LoadingState } from '@/shared/ui'

/**
 * Comprobante interno imprimible. Muestra solo datos históricos del servidor, nunca costos;
 * la impresión oculta navegación y acciones mediante CSS, sin PDF ni motor nuevo.
 */
export function SaleDocumentPage() {
  const id = Number(useParams().id)
  const query = useSaleDocument(Number.isFinite(id) ? id : null)
  if (query.isPending) return <LoadingState label="Cargando comprobante…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar el comprobante" tone="danger">
        El comprobante solo existe para ventas confirmadas o anuladas.{' '}
        <Link className="underline" to={`/sales/${id}`}>
          Volver a la venta
        </Link>
      </InlineNotice>
    )
  }
  const doc = query.data
  const sheet: SheetData = {
    heading: saleStateLabels[doc.state],
    number: doc.number,
    issuer: doc.issuer,
    customer: doc.customer,
    condition: doc.condition,
    date: doc.operational_date,
    lines: doc.lines,
    totals: {
      base: doc.base_total,
      tax: doc.tax_total,
      total: doc.grand_total,
    },
    voided: doc.voided
      ? { reason: doc.void_reason, at: doc.voided_at }
      : undefined,
  }
  return (
    <div className="catalog-page space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link className="underline" to={`/sales/${id}`}>
          Volver a la venta
        </Link>
        <Button
          onClick={() => window.print()}
          type="button"
          variant="secondary"
        >
          <Printer aria-hidden="true" size={16} />
          Imprimir comprobante
        </Button>
      </div>
      <SalesDocument data={sheet} />
    </div>
  )
}

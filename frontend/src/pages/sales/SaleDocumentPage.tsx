import { ArrowLeft, Printer } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useSaleDocument } from '@/features/sales/hooks'
import { SalesDocument, type SheetData } from '@/features/sales/SalesDocument'
import { saleStateLabels } from '@/features/sales/types'
import { Button, InlineNotice, LoadingState } from '@/shared/ui'
import { useSheetBrandReady } from '@/shared/ui/business'

/**
 * Comprobante interno imprimible. Muestra solo datos históricos del servidor, nunca costos;
 * la impresión oculta navegación y acciones mediante CSS, sin PDF ni motor nuevo.
 */
export function SaleDocumentPage() {
  const id = Number(useParams().id)
  const query = useSaleDocument(Number.isFinite(id) ? id : null)
  const brand = useSheetBrandReady()
  if (query.isPending) return <LoadingState label="Cargando comprobante…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar el comprobante" tone="danger">
        El comprobante solo existe para ventas confirmadas o anuladas.{' '}
        <Link
          className="font-semibold text-accent hover:underline"
          to={`/sales/${id}`}
        >
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
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link
          aria-label="Volver a la venta"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a la venta"
          to={`/sales/${id}`}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-label text-ink-muted">Comprobante interno</p>
          <h1 className="code text-page font-semibold text-ink">
            {doc.number ?? 'Sin número'}
          </h1>
        </div>
        <Button
          aria-busy={!brand.ready}
          disabled={!brand.ready}
          onClick={() => window.print()}
          type="button"
          variant="secondary"
        >
          <Printer aria-hidden="true" size={16} />
          Imprimir comprobante
        </Button>
      </div>
      <div className="rounded-panel bg-workspace p-4 max-sm:p-2 print:bg-transparent print:p-0">
        <SalesDocument data={sheet} onBrandReady={brand.onBrandReady} />
      </div>
    </div>
  )
}

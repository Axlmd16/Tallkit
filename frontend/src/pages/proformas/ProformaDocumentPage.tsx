import { ArrowLeft, Printer } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useProformaDocument } from '@/features/proformas/hooks'
import { ProformaDocument } from '@/features/proformas/ProformaDocument'
import { Button, InlineNotice, LoadingState } from '@/shared/ui'
import { useSheetBrandReady } from '@/shared/ui/business'

/**
 * Cotización imprimible en A4. Muestra solo datos históricos del servidor y el logo
 * conservado al emitir. Imprimir o guardar como PDF es la función del navegador; el botón
 * se habilita cuando el encabezado ya no cambiará.
 */
export function ProformaDocumentPage() {
  const id = Number(useParams().id)
  const query = useProformaDocument(Number.isFinite(id) ? id : null)
  const brand = useSheetBrandReady()
  if (query.isPending) return <LoadingState label="Cargando proforma…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar la proforma" tone="danger">
        El documento solo existe para proformas emitidas.{' '}
        <Link
          className="font-semibold text-accent hover:underline"
          to={`/proformas/${id}`}
        >
          Volver a la proforma
        </Link>
      </InlineNotice>
    )
  }
  const doc = query.data
  return (
    <div className="catalog-page space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link
          aria-label="Volver a la proforma"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a la proforma"
          to={`/proformas/${id}`}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-label text-ink-muted">Proforma</p>
          <h1 className="code text-page font-semibold text-ink">
            {doc.number}
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
          Imprimir o guardar PDF
        </Button>
      </div>
      {/* En pantallas estrechas la hoja se desplaza dentro de su panel; al imprimir no se recorta. */}
      <div
        aria-label="Documento de la proforma"
        className="overflow-x-auto rounded-panel bg-workspace p-4 max-sm:p-2 print:overflow-visible print:bg-transparent print:p-0"
        role="region"
        tabIndex={0}
      >
        <ProformaDocument
          data={doc}
          id={id}
          onBrandReady={brand.onBrandReady}
        />
      </div>
    </div>
  )
}

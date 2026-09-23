import { DocumentSheet } from '@/shared/ui'

import { documentDate, usd } from './format'
import { documentTypeLabels, type DocumentType, type MoneyBlock } from './types'

export interface PurchaseDocumentLine {
  key: string
  code: string | null
  name: string | null
  quantity: string
  unitCost: string | null
  tax: string | null
  total: string | null
}

/** Hoja interna del ingreso. Los importes provienen del servidor o se muestran como guion. */
export function PurchaseDocument({
  documentDateValue,
  documentReference,
  documentType,
  lines,
  number,
  stale,
  supplier,
  totals,
}: {
  documentDateValue: string
  documentReference: string
  documentType: DocumentType
  lines: PurchaseDocumentLine[]
  number: string | null
  stale: boolean
  supplier: string
  totals: MoneyBlock | null
}) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : usd(value)

  return (
    <DocumentSheet
      label="Comprobante de ingreso"
      meta={[
        {
          label: 'Fecha documental',
          value: documentDateValue ? documentDate(documentDateValue) : '—',
        },
        { label: 'Proveedor', value: supplier || '—', wide: true },
        {
          label: 'Documento recibido',
          value: `${documentTypeLabels[documentType]}${documentReference ? ` · ${documentReference}` : ''}`,
          wide: true,
        },
      ]}
      notice="Documento interno de control. No constituye una factura electrónica autorizada por el SRI."
      number={number}
      state="Borrador · Vista previa"
    >
      <section aria-label="Líneas" className="sheet-lines">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th className="amount">Cantidad</th>
              <th className="amount">Costo</th>
              <th className="amount">Impuesto</th>
              <th className="amount">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td className="empty" colSpan={6}>Sin líneas.</td>
              </tr>
            )}
            {lines.map((line) => (
              <tr key={line.key}>
                <td className="font-mono" data-label="Código">{line.code ?? '—'}</td>
                <td data-label="Descripción">{line.name ?? '—'}</td>
                <td className="amount" data-label="Cantidad">{line.quantity || '—'}</td>
                <td className={`amount ${stale ? 'pending-value' : ''}`} data-label="Costo">{money(line.unitCost)}</td>
                <td className={`amount ${stale ? 'pending-value' : ''}`} data-label="Impuesto">{money(line.tax)}</td>
                <td className={`amount ${stale ? 'pending-value' : ''}`} data-label="Total">{money(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer className="sheet-foot">
        <div className={`sheet-totals ${stale ? 'pending-value' : ''}`}>
          <p><span>Base imponible</span><span>{money(totals?.base)}</span></p>
          <p><span>Impuesto</span><span>{money(totals?.tax)}</span></p>
          <p className="grand"><span>Total</span><span>{money(totals?.total)}</span></p>
        </div>
      </footer>
    </DocumentSheet>
  )
}

import { Wrench } from '@phosphor-icons/react'

import './sales.css'

import {
  INTERNAL_NOTICE,
  conditionLabels,
  type DocumentLine,
  type SaleCondition,
  type SaleCustomer,
  type Totals,
} from './types'
import { documentDate, usd } from './format'

export interface SheetData {
  /** «Borrador · Vista previa» o el estado del comprobante confirmado. */
  heading: string
  /** Número interno asignado o ``null`` mientras esté pendiente. */
  number: string | null
  issuer: { legal_name: string; ruc: string } | null
  customer: SaleCustomer | null
  condition: SaleCondition | null
  date: string | null
  lines: DocumentLine[]
  totals:
    | Totals
    | { base: string | null; tax: string | null; total: string | null }
    | null
  voided?: { reason: string; at: string | null } | undefined
}

/**
 * Hoja del comprobante interno. Se usa tal cual en la vista previa del editor y en el
 * comprobante confirmado: cabecera, identidad fiscal, cliente, líneas y totales. Nunca
 * calcula importes: muestra los del servidor y guiones cuando faltan, jamás ceros inventados.
 */
export function SalesDocument({
  data,
  updating = false,
  stale = false,
}: {
  data: SheetData
  /** Hay una actualización en curso: los valores visibles quedan pendientes. */
  updating?: boolean
  /** Los valores visibles no corresponden a la captura actual. */
  stale?: boolean
}) {
  const cell = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : usd(value)
  const pending = updating || stale
  return (
    <article
      aria-busy={updating}
      aria-label="Comprobante de venta"
      className="sales-sheet"
    >
      <header className="sheet-head">
        <div className="sheet-brand">
          <span aria-hidden="true" className="sheet-mark">
            <Wrench size={18} weight="bold" />
          </span>
          <span>Sys-Taller</span>
        </div>
        <div className="sheet-kind">
          <p className="sheet-title">COMPROBANTE INTERNO</p>
          <p className="sheet-state">{data.heading}</p>
        </div>
      </header>
      <dl className="sheet-meta">
        <div>
          <dt>Número</dt>
          <dd>{data.number ?? 'Pendiente de confirmación'}</dd>
        </div>
        <div>
          <dt>Fecha operativa</dt>
          <dd>{data.date ? documentDate(data.date) : '—'}</dd>
        </div>
        <div>
          <dt>Emisor</dt>
          <dd>
            {data.issuer
              ? `${data.issuer.legal_name} · RUC ${data.issuer.ruc} (comercial)`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Condición de venta</dt>
          <dd>{data.condition ? conditionLabels[data.condition] : '—'}</dd>
        </div>
        <div className="wide">
          <dt>Cliente</dt>
          <dd>
            {data.customer
              ? [
                  data.customer.name,
                  data.customer.identification &&
                    `${data.customer.identification_type ?? ''} ${data.customer.identification}`.trim(),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '—'}
          </dd>
        </div>
      </dl>
      <section aria-label="Líneas" className="sheet-lines">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th className="amount">Cantidad</th>
              <th className="amount">Precio</th>
              <th className="amount">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.length === 0 && (
              <tr>
                <td className="empty" colSpan={5}>
                  Sin líneas.
                </td>
              </tr>
            )}
            {data.lines.map((line) => (
              <tr key={line.position}>
                <td data-label="Código">{line.product_code ?? '—'}</td>
                <td data-label="Descripción">{line.product_name ?? '—'}</td>
                <td className="amount" data-label="Cantidad">
                  {line.quantity}
                </td>
                <td
                  className={`amount ${pending ? 'pending-value' : ''}`}
                  data-label="Precio"
                >
                  {cell(line.unit_price)}
                </td>
                <td
                  className={`amount ${pending ? 'pending-value' : ''}`}
                  data-label="Total"
                >
                  {cell(line.total_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer className="sheet-foot">
        <div className={`sheet-totals ${pending ? 'pending-value' : ''}`}>
          <p>
            <span>Base imponible</span>
            <span>{cell(data.totals?.base)}</span>
          </p>
          <p>
            <span>Impuesto</span>
            <span>{cell(data.totals?.tax)}</span>
          </p>
          <p className="grand">
            <span>Total</span>
            <span>{cell(data.totals?.total)}</span>
          </p>
        </div>
        {data.voided && (
          <p className="mt-2 text-sm font-semibold text-warning">
            Venta anulada{data.voided.reason ? `: ${data.voided.reason}` : ''}.
            Se conservan el número y los valores originales.
          </p>
        )}
        <p className="sheet-notice">{INTERNAL_NOTICE}</p>
      </footer>
    </article>
  )
}

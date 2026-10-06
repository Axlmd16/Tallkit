import '@/features/sales/sales.css'
import { DocumentSheet } from '@/shared/ui/business/DocumentSheet'

import { proformaLogoUrl } from './api'
import { documentDate, usd } from './format'
import {
  proformaStateLabels,
  QUOTE_TITLE,
  type ProformaDocument as DocumentData,
} from './types'

/**
 * Hoja A4 de la cotización que se entrega al cliente. Usa exclusivamente los datos y el logo
 * conservados al emitir: nunca consulta la marca vigente de la configuración. Muestra solo lo
 * que el cliente necesita: productos con su código y el del fabricante, cantidades, precios y
 * totales. No muestra disponibilidad, avisos internos, condición de cobro ni costos, y no
 * calcula importes.
 */
export function ProformaDocument({
  id,
  data,
  onBrandReady,
}: {
  id: number
  data: DocumentData
  /** Avisa cuando el encabezado del emisor está listo para imprimir. */
  onBrandReady?: ((ready: boolean) => void) | undefined
}) {
  const issuer = data.issuer
  const expired = data.state === 'EXPIRED'
  return (
    <DocumentSheet
      issuer={{
        name: issuer.trade_name || issuer.legal_name,
        // Sin logo emitido no se reserva un hueco ni se usa otro logo.
        logoUrl: data.has_logo ? proformaLogoUrl(id) : null,
      }}
      label="Proforma"
      meta={[
        { label: 'Fecha de emisión', value: documentDate(data.issue_date) },
        {
          label: 'Vigente hasta',
          value: `${documentDate(data.valid_until)}${expired ? ' (vencida)' : ''}`,
        },
        {
          label: 'Emisor',
          value: (
            <>
              {issuer.legal_name} · RUC{' '}
              <span className="font-mono">{issuer.ruc}</span> (comercial)
            </>
          ),
        },
        {
          label: 'Cliente',
          wide: true,
          value: [
            data.customer.name,
            `${data.customer.identification_type} ${data.customer.identification}`,
            data.customer.phone,
          ]
            .filter(Boolean)
            .join(' · '),
        },
      ]}
      notice={null}
      number={data.number}
      onBrandReady={onBrandReady}
      state={proformaStateLabels[data.state]}
      title={QUOTE_TITLE}
    >
      <section aria-label="Líneas" className="sheet-lines">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cód. fabricante</th>
              <th>Descripción</th>
              <th className="amount">Cantidad</th>
              <th className="amount">Precio</th>
              <th className="amount">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.position}>
                <td className="font-mono" data-label="Código">
                  {line.product_code ?? '—'}
                </td>
                <td className="font-mono" data-label="Cód. fabricante">
                  {line.manufacturer_code || '—'}
                </td>
                <td data-label="Descripción">{line.product_name ?? '—'}</td>
                <td className="amount" data-label="Cantidad">
                  {line.quantity}
                </td>
                <td className="amount" data-label="Precio">
                  {usd(line.unit_price)}
                </td>
                <td className="amount" data-label="Total">
                  {usd(line.total_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer className="sheet-foot">
        <div className="sheet-totals">
          <p>
            <span>Base imponible</span>
            <span>{usd(data.base_total)}</span>
          </p>
          <p>
            <span>Impuesto</span>
            <span>{usd(data.tax_total)}</span>
          </p>
          <p className="grand">
            <span>Total</span>
            <span>{usd(data.grand_total)}</span>
          </p>
        </div>
        {data.state !== 'VALID' && (
          <p className="mt-2 text-sm font-semibold text-warning">
            Proforma {proformaStateLabels[data.state].toLowerCase()}. Se
            conservan el número, la vigencia y los valores originales.
          </p>
        )}
      </footer>
    </DocumentSheet>
  )
}

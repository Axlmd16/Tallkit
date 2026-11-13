import { ArrowRight } from '@phosphor-icons/react'

import { Money, StatusBadge } from '@/shared/ui'

import type {
  ComparisonProduct,
  ComparisonSide,
  QuoteComparison as Comparison,
} from './types'

const statusLabel = {
  UNCHANGED: 'Sin cambios',
  CHANGED: 'Cambió',
  REMOVED: 'Retirado',
  ADDED: 'Agregado',
} as const
const statusTone = {
  UNCHANGED: 'neutral',
  CHANGED: 'warning',
  REMOVED: 'danger',
  ADDED: 'info',
} as const
const changeLabel = {
  quantity: 'cantidad',
  unit_price: 'precio',
  tax_rate: 'impuesto',
} as const

function Pair({
  product,
  field,
  money = false,
  suffix = '',
}: {
  product: ComparisonProduct
  field: keyof ComparisonSide
  money?: boolean
  suffix?: string
}) {
  const show = (side: ComparisonSide | null) => {
    const value = side?.[field] ?? null
    if (value === null) return <span className="text-ink-muted">—</span>
    return money ? <Money amount={value} /> : `${value}${suffix}`
  }
  const changed =
    product.quoted?.[field] !== product.current?.[field] &&
    product.status !== 'UNCHANGED'
  return (
    <span
      className={`inline-flex items-center justify-end gap-1.5 ${changed ? 'font-semibold text-ink' : ''}`}
    >
      {show(product.quoted)}
      <ArrowRight
        aria-label="ahora"
        className="shrink-0 text-ink-muted"
        size={12}
      />
      {show(product.current)}
    </span>
  )
}

/**
 * Comparación entre lo cotizado y los valores actuales, calculada en el servidor. Solo
 * presenta: no decide precios ni permite editarlos. Cada estado lleva texto además de color.
 */
export function QuoteComparison({
  comparison,
  currentLabel = 'Venta actual',
}: {
  comparison: Comparison
  currentLabel?: string
}) {
  const { totals } = comparison
  return (
    <section aria-label="Comparación con la cotización" className="space-y-3">
      <div
        aria-label="Tabla de comparación"
        className="overflow-x-auto"
        role="group"
        tabIndex={0}
      >
        <table className="w-full min-w-[520px] text-body">
          <caption className="sr-only">
            Productos cotizados frente a {currentLabel.toLowerCase()}: cantidad,
            precio final, impuesto y total
          </caption>
          <thead>
            <tr className="text-left text-label text-ink-muted">
              <th className="py-1.5 pr-3 font-semibold" scope="col">
                Producto
              </th>
              <th className="px-2 py-1.5 text-right font-semibold" scope="col">
                Cantidad
              </th>
              <th className="px-2 py-1.5 text-right font-semibold" scope="col">
                Precio final
              </th>
              <th className="px-2 py-1.5 text-right font-semibold" scope="col">
                Impuesto %
              </th>
              <th className="px-2 py-1.5 text-right font-semibold" scope="col">
                Total
              </th>
              <th className="py-1.5 pl-2 font-semibold" scope="col">
                Cambio
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.products.map((product) => (
              <tr className="border-t border-line" key={product.product_id}>
                <th className="py-2 pr-3 text-left font-normal" scope="row">
                  <span className="code">{product.product_code}</span>{' '}
                  {product.product_name}
                </th>
                <td className="px-2 py-2 text-right tabular-nums">
                  <Pair field="quantity" product={product} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <Pair field="unit_price" money product={product} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <Pair field="tax_rate" product={product} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <Pair field="total_amount" money product={product} />
                </td>
                <td className="py-2 pl-2">
                  <StatusBadge
                    label={
                      product.status === 'CHANGED'
                        ? `Cambió ${product.changes.map((c) => changeLabel[c]).join(', ')}`
                        : statusLabel[product.status]
                    }
                    tone={statusTone[product.status]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-body">
        <div>
          <dt className="text-label text-ink-muted">Total cotizado</dt>
          <dd className="font-semibold tabular-nums">
            <Money amount={totals.quoted?.total ?? null} />
          </dd>
        </div>
        <div>
          <dt className="text-label text-ink-muted">{currentLabel}</dt>
          <dd className="font-semibold tabular-nums">
            <Money amount={totals.current?.total ?? null} />
          </dd>
        </div>
        <div>
          <dt className="text-label text-ink-muted">Diferencia</dt>
          <dd className="font-semibold tabular-nums">
            <Money amount={totals.difference} />
          </dd>
        </div>
      </dl>
    </section>
  )
}

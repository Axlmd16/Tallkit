import { useState } from 'react'
import { Link } from 'react-router'

import { SegmentedControl, SkeletonRows } from '@/shared/ui'

import type { Kardex, KardexRow } from './types'

type Filter = '' | 'in' | 'out'

const KIND_LABELS: Record<KardexRow['movement_type'], string> = {
  PURCHASE_RECEIPT: 'Entrada de mercadería',
  INITIAL_LOAD: 'Carga inicial',
  ADJUSTMENT_IN: 'Ajuste de entrada',
  ADJUSTMENT_OUT: 'Ajuste de salida',
  REVERSAL: 'Reverso',
  SALE_OUT: 'Venta',
  CUSTOMER_RETURN_IN: 'Devolución de un cliente',
}

const dayFormat = new Intl.DateTimeFormat('es-EC', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Guayaquil',
})
const timeFormat = new Intl.DateTimeFormat('es-EC', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Guayaquil',
})

const isZero = (value: string) => Number(value) === 0

/** Cantidad con signo: lo que entra suma y lo que sale resta. */
function signed(row: KardexRow): { text: string; entering: boolean } {
  return isZero(row.quantity_in)
    ? { text: `−${Number(row.quantity_out)}`, entering: false }
    : { text: `+${Number(row.quantity_in)}`, entering: true }
}

/**
 * Entradas y salidas de un producto en el periodo consultado, de la más reciente a la más
 * antigua. Es una lectura: cada movimiento queda registrado y no se borra. El Kardex completo
 * sigue disponible en su propia pantalla.
 */
export function ProductMovements({
  kardex,
  isPending,
  isError,
  kardexTo,
  backTo,
}: {
  kardex: Kardex | undefined
  isPending: boolean
  isError: boolean
  kardexTo: string
  backTo: string
}) {
  const [filter, setFilter] = useState<Filter>('')
  if (isPending) return <SkeletonRows rows={4} />
  if (isError || !kardex)
    return (
      <p className="text-body text-danger" role="alert">
        No se pudieron consultar los movimientos. Reintente en unos instantes.
      </p>
    )
  const rows = [...kardex.results]
    .reverse()
    .filter((row) =>
      filter === 'in'
        ? !isZero(row.quantity_in)
        : filter === 'out'
          ? !isZero(row.quantity_out)
          : true,
    )
  return (
    <section
      aria-label="Movimientos del producto"
      className="rounded-card border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="text-body text-ink-muted">
          Cada entrada y salida queda registrada y no se borra.
        </span>
        <SegmentedControl
          aria-label="Tipo de movimiento"
          onChange={(value) => setFilter(value as Filter)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'in', label: 'Entradas' },
            { value: 'out', label: 'Salidas' },
          ]}
          value={filter}
        />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-body text-ink-muted">
          No hay movimientos en los últimos 30 días.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const quantity = signed(row)
            const at = new Date(row.effective_at)
            return (
              <li
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3"
                key={row.ordinal}
              >
                <span className="leading-snug">
                  <span className="block text-body font-semibold">
                    {dayFormat.format(at)}
                  </span>
                  <span className="text-label text-ink-muted">
                    {timeFormat.format(at)}
                  </span>
                </span>
                <span className="min-w-0 leading-snug">
                  <span className="block font-semibold">
                    {KIND_LABELS[row.movement_type]}
                  </span>
                  <span className="code text-label text-ink-muted">
                    {row.source.reference}
                  </span>
                </span>
                <span
                  className={`font-bold tabular-nums ${quantity.entering ? 'text-success' : 'text-danger'}`}
                >
                  {quantity.text}
                </span>
                <span
                  className="text-label text-ink-muted tabular-nums"
                  title="Quedaban"
                >
                  {Number(row.quantity_after)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="border-t border-line px-5 py-3 text-right text-body">
        <Link
          className="font-semibold text-accent hover:underline"
          state={{ from: backTo }}
          to={kardexTo}
        >
          Ver todo el Kardex
        </Link>
      </p>
    </section>
  )
}

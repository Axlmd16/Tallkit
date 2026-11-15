import type { CollectionItem, HomeCollections } from '@/features/home/types'
import { scopeOf } from '@/features/home/pendingTargets'
import { useBusinessName } from '@/shared/api/entity-logos'
import { Money } from '@/shared/ui'

import type { BlockQuery } from './BlockStates'

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria con que el servidor agrupó los cobros. */
export function todayIn(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  } catch {
    return ''
  }
}

/** Importe cobrado hoy por un negocio; `null` si la respuesta no trae el día de hoy. */
export function collectedToday(
  item: CollectionItem,
  today: string,
): string | null {
  return item.days.find((day) => day.date === today)?.amount ?? null
}

const TONES = {
  commercial: { stroke: 'stroke-[#c9a574]', dot: 'bg-[#c9a574] rounded-[2px]' },
  artesanal: { stroke: 'stroke-[#8ea3bd]', dot: 'bg-[#8ea3bd] rounded-full' },
} as const

function ScopeLine({
  item,
  amount,
}: {
  item: CollectionItem
  amount: string | null
}) {
  const scope = scopeOf(item.scope)
  const name = useBusinessName(scope)
  return (
    <p className="flex items-center gap-2 text-label text-graphite-ink">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 ${TONES[scope].dot}`}
      />
      <span className="min-w-0 leading-tight">{name}</span>
      <b className="ml-auto font-semibold text-white">
        <Money amount={amount} />
      </b>
    </p>
  )
}

/**
 * «Cobrado hoy»: un anillo por negocio con su importe del día. Cada negocio va con su propio
 * importe y no existe un total conjunto: repuestos y servicios son dos RUC distintos.
 */
export function CashToday({ query }: { query: BlockQuery<HomeCollections> }) {
  if (query.isPending) {
    return (
      <div
        aria-label="Cargando cobros de hoy…"
        className="h-28 animate-pulse rounded-card bg-white/5"
        role="status"
      />
    )
  }
  if (query.isError || query.data === undefined) return null
  const { items, timezone } = query.data
  if (items.length === 0) return null

  const today = todayIn(timezone)
  const rows = items.map((item) => ({
    item,
    amount: collectedToday(item, today),
  }))
  const values = rows.map((row) => Number(row.amount ?? 0))
  const sum = values.reduce((a, b) => a + b, 0)
  let offset = 0
  const arcs = rows.map((row, index) => {
    const length = sum > 0 ? (values[index]! / sum) * CIRCUMFERENCE : 0
    const arc = { key: row.item.scope, length, offset }
    offset += length
    return arc
  })

  return (
    <section
      aria-label="Cobrado hoy"
      className="relative flex items-center gap-4 rounded-card bg-white/5 p-4 ring-1 ring-white/10"
    >
      <svg
        aria-hidden="true"
        className="shrink-0"
        height="96"
        viewBox="0 0 104 104"
        width="96"
      >
        <circle
          cx="52"
          cy="52"
          fill="none"
          r={RADIUS}
          stroke="#34393f"
          strokeWidth="12"
        />
        {arcs.map((arc, index) => (
          <circle
            className={TONES[scopeOf(rows[index]!.item.scope)].stroke}
            cx="52"
            cy="52"
            data-scope={rows[index]!.item.scope}
            fill="none"
            key={arc.key}
            r={RADIUS}
            strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
            strokeDashoffset={-arc.offset}
            strokeWidth="12"
            transform="rotate(-90 52 52)"
          />
        ))}
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-label text-graphite-ink">Cobrado hoy</p>
        {rows.map((row) => (
          <ScopeLine amount={row.amount} item={row.item} key={row.item.scope} />
        ))}
      </div>
    </section>
  )
}

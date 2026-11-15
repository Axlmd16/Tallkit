import { Plus } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import { InlineNotice, Money, useToast } from '@/shared/ui'

import { useBillingMutations, usePartSearch } from './billingHooks'
import { useMaintenanceMutations, useServiceSearch } from './hooks'
import type { MaintenanceOrder } from './types'

const MAX_RESULTS = 4

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Caja de búsqueda con sus resultados; cada resultado se agrega con un toque. */
function Adder({
  label,
  placeholder,
  text,
  onText,
  error,
  searched,
  empty,
  loading,
  children,
  className = '',
}: {
  label: string
  placeholder: string
  text: string
  onText: (value: string) => void
  error: string
  searched: boolean
  empty: boolean
  loading: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const show = searched && open
  return (
    <div
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <Plus
          aria-hidden="true"
          className="absolute top-3.5 left-0.5 text-ink-muted"
          size={18}
          weight="bold"
        />
        <input
          autoComplete="off"
          className="h-11 w-full border-0 border-b-[1.5px] border-line-strong bg-transparent pl-8 text-body font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-muted focus:border-ink"
          onChange={(event) => {
            onText(event.target.value)
            setOpen(true)
          }}
          placeholder={placeholder}
          style={{ outline: 'none' }}
          value={text}
        />
      </label>
      {error && (
        <div className="mt-2">
          <InlineNotice title="No se agregó" tone="danger">
            {error}
          </InlineNotice>
        </div>
      )}
      {show && (
        <ul
          aria-label="Resultados"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-group border border-line bg-surface p-1 shadow-menu"
        >
          {children}
          {loading && (
            <li className="px-3 py-3 text-body text-ink-muted" role="status">
              Buscando…
            </li>
          )}
          {!loading && empty && (
            <li className="px-3 py-3 text-body text-ink-muted">
              Nada coincide con lo escrito.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function ResultRow({
  name,
  sub,
  price,
  onAdd,
}: {
  name: string
  sub?: string
  price: string
  onAdd: () => void
}) {
  return (
    <li>
      <button
        aria-label={`Agregar ${name}`}
        className="group flex min-h-12 w-full items-center gap-4 rounded-control px-3.5 py-2.5 text-left hover:bg-surface-subtle"
        onClick={onAdd}
        type="button"
      >
        <span className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="truncate font-semibold">{name}</span>
          {sub && (
            <span className="truncate text-label text-ink-muted">{sub}</span>
          )}
        </span>
        <Money amount={price} className="font-semibold text-ink-muted" />
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent-strong transition-colors group-hover:bg-accent group-hover:text-white"
        >
          <Plus size={14} weight="bold" />
        </span>
      </button>
    </li>
  )
}

/**
 * Buscador para agregar un trabajo (servicio) a la orden con cantidad 1 y el precio referencial
 * del catálogo, por el mismo endpoint de siempre. En una corrección se agrega sin cargo.
 */
export function ServiceAdder({
  order,
  corrective = false,
}: {
  order: MaintenanceOrder
  corrective?: boolean
}) {
  const toast = useToast()
  const tracker = useIntentTracker()
  const mutations = useMaintenanceMutations()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const term = useDebounced(text.trim())
  const query = useServiceSearch(term)
  const rows = (query.data?.results ?? []).slice(0, MAX_RESULTS)

  async function add(service: { id: number; name: string }) {
    setError('')
    try {
      await tracker.run(
        { service: service.id, version: order.version },
        (key) =>
          mutations.addLine.mutateAsync({
            id: order.id,
            data: { service_id: service.id, quantity: 1 },
            expectedVersion: order.version,
            key,
          }),
      )
      toast.success(`Servicio «${service.name}» agregado.`)
      setText('')
    } catch (failure) {
      setError(describeProblem(failure).message)
    }
  }

  return (
    <Adder
      className="px-5 pb-4"
      empty={rows.length === 0}
      error={error}
      label="Agregar trabajo"
      loading={term !== '' && query.isPending}
      onText={setText}
      placeholder={
        corrective
          ? 'Agregar trabajo sin cargo: escriba el nombre, por ejemplo «aceite»'
          : 'Agregar trabajo: escriba el nombre, por ejemplo «aceite»'
      }
      searched={term !== ''}
      text={text}
    >
      {rows.map((service) => (
        <ResultRow
          key={service.id}
          name={service.name}
          onAdd={() => void add(service)}
          price={service.reference_price}
        />
      ))}
    </Adder>
  )
}

/**
 * Buscador de repuestos del almacén: cada uno se agrega como reserva de la venta vinculada, con
 * cantidad 1. No descuenta inventario ni genera deuda hasta que se confirma la venta.
 */
export function PartAdder({ order }: { order: MaintenanceOrder }) {
  const toast = useToast()
  const tracker = useIntentTracker()
  const mutations = useBillingMutations()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const term = useDebounced(text.trim())
  const query = usePartSearch(order.id, term)
  const rows = (query.data?.results ?? []).slice(0, MAX_RESULTS)

  async function add(part: { id: number; name: string }) {
    setError('')
    try {
      await tracker.run({ part: part.id, version: order.version }, (key) =>
        mutations.addPart.mutateAsync({
          id: order.id,
          productId: part.id,
          quantity: '1',
          expectedVersion: order.version,
          key,
        }),
      )
      toast.success(`Repuesto «${part.name}» reservado.`)
      setText('')
    } catch (failure) {
      setError(describeProblem(failure).message)
    }
  }

  return (
    <Adder
      className="mb-1"
      empty={rows.length === 0}
      error={error}
      label="Agregar repuesto"
      loading={term !== '' && query.isPending}
      onText={setText}
      placeholder="Buscar repuesto por nombre o código"
      searched={term !== ''}
      text={text}
    >
      {rows.map((part) => (
        <ResultRow
          key={part.id}
          name={part.name}
          onAdd={() => void add(part)}
          price={part.sale_price}
          sub={`${part.code} · disponible ${part.available}`}
        />
      ))}
    </Adder>
  )
}

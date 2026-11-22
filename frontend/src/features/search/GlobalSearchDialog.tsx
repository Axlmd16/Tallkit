import {
  CaretRight,
  FileText,
  MagnifyingGlass,
  Package,
} from '@phosphor-icons/react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router'

import { documentDate } from '@/features/maintenance/format'
import { useBusinessName } from '@/shared/api/entity-logos'
import { Button, Money, StatusBadge } from '@/shared/ui'

import { useGlobalSearch } from './hooks'
import {
  loadRecentSearches,
  recordRecentSearch,
  type RecentSearchEntry,
} from './recent'
import type { SearchInvoiceState } from './types'

const STATE_LABELS: Record<SearchInvoiceState, string> = {
  DRAFT: 'Borrador',
  PREPARED: 'Preparada, sin enviar',
  CANCELLED: 'Cancelada',
}

const STATE_TONES = {
  DRAFT: 'neutral',
  PREPARED: 'info',
  CANCELLED: 'warning',
} as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

interface FlatOption {
  recent: RecentSearchEntry
  to: string
}

export function GlobalSearchDialog({
  open,
  initialQuery,
  username,
  onClose,
}: {
  open: boolean
  initialQuery: string
  username: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(0)
  const [recents, setRecents] = useState<RecentSearchEntry[]>([])

  const commercialName = useBusinessName('commercial')
  const artisanName = useBusinessName('artesanal')

  useEffect(() => {
    if (!open) return
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setQuery(initialQuery)
    setActiveIndex(0)
    setRecents(loadRecentSearches(username))
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open, initialQuery, username])

  const close = () => {
    onClose()
    window.setTimeout(() => returnFocusRef.current?.focus(), 0)
  }

  const trimmed = query.trim()
  const searchQuery = useGlobalSearch(query, open)
  const data = trimmed.length >= 2 ? searchQuery.data : undefined

  const flatOptions = useMemo<FlatOption[]>(() => {
    if (trimmed.length < 2) {
      return recents.map((entry) => ({ recent: entry, to: entry.to }))
    }
    if (!data) return []
    const list: FlatOption[] = []
    for (const v of data.vehicles?.items ?? []) {
      const to = v.open_order
        ? `/maintenance/${v.open_order.id}`
        : `/vehicles/${v.id}`
      list.push({
        to,
        recent: {
          key: `vehicle:${v.id}`,
          kind: 'vehicle',
          title: v.owner_name || v.label,
          subtitle: v.label,
          badge: v.plate,
          to,
        },
      })
    }
    for (const c of data.customers?.items ?? []) {
      const to = `/customers/${c.id}`
      list.push({
        to,
        recent: {
          key: `customer:${c.id}`,
          kind: 'customer',
          title: c.full_name,
          subtitle: `${c.identification_type} ${c.identification}`,
          to,
        },
      })
    }
    for (const inv of data.invoices?.items ?? []) {
      const to = `/fiscal/preparations/${inv.id}`
      list.push({
        to,
        recent: {
          key: `invoice:${inv.id}`,
          kind: 'invoice',
          title: inv.number ?? 'Sin número',
          subtitle: inv.customer_name ?? '—',
          to,
        },
      })
    }
    for (const p of data.products?.items ?? []) {
      const to = `/products/${p.id}`
      list.push({
        to,
        recent: {
          key: `product:${p.id}`,
          kind: 'product',
          title: p.name,
          subtitle: `Código ${p.code}`,
          to,
        },
      })
    }
    return list
  }, [data, recents, trimmed.length])

  useEffect(() => {
    setActiveIndex(0)
  }, [trimmed, flatOptions.length])

  if (!open) return null

  const choose = (option: FlatOption) => {
    setRecents(recordRecentSearch(username, option.recent))
    onClose()
    void navigate(option.to)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (flatOptions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % flatOptions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(
        (prev) => (prev - 1 + flatOptions.length) % flatOptions.length,
      )
    } else if (event.key === 'Enter') {
      const target = flatOptions[activeIndex]
      if (target) {
        event.preventDefault()
        choose(target)
      }
    }
  }

  const totalMatches =
    (data?.vehicles?.items.length ?? 0) +
    (data?.customers?.items.length ?? 0) +
    (data?.invoices?.items.length ?? 0) +
    (data?.products?.items.length ?? 0)

  const vehiclesOffset = 0
  const customersOffset = data?.vehicles?.items.length ?? 0
  const invoicesOffset = customersOffset + (data?.customers?.items.length ?? 0)
  const productsOffset = invoicesOffset + (data?.invoices?.items.length ?? 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-graphite/45 px-3 pt-10 pb-6 sm:px-4 sm:pt-20"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      onKeyDown={onKeyDown}
    >
      <div
        aria-label="Búsqueda global"
        aria-modal="true"
        className="flex max-h-[80vh] w-full max-w-[40rem] flex-col overflow-hidden rounded-dialog bg-surface text-ink shadow-menu"
        role="dialog"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <MagnifyingGlass
            aria-hidden="true"
            className="shrink-0 text-ink"
            size={20}
            weight="bold"
          />
          <label className="min-w-0 flex-1">
            <span className="sr-only">Buscar en todo el sistema</span>
            <input
              autoComplete="off"
              className="min-h-11 w-full bg-transparent text-lead font-medium text-ink outline-none placeholder:text-ink-muted"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Placa, cliente, cédula, producto o factura"
              ref={inputRef}
              type="search"
              value={query}
            />
          </label>
          <button
            className="inline-flex min-h-11 shrink-0 items-center rounded-control bg-canvas px-3 text-label font-semibold text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={close}
            type="button"
          >
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-3">
          {trimmed.length < 2 ? (
            recents.length > 0 ? (
              <div>
                <div className="px-5 pt-3 pb-1.5 text-label font-semibold text-ink-muted">
                  Buscados hace poco
                </div>
                {recents.map((entry, idx) => {
                  const active = idx === activeIndex
                  return (
                    <button
                      className={`mx-2 flex min-h-11 w-[calc(100%-1rem)] items-center gap-3 rounded-control px-3 py-2 text-left transition-colors ${
                        active ? 'bg-canvas' : 'hover:bg-canvas'
                      }`}
                      key={entry.key}
                      onClick={() => choose({ recent: entry, to: entry.to })}
                      onMouseEnter={() => setActiveIndex(idx)}
                      type="button"
                    >
                      {entry.badge && (
                        <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-graphite px-2 text-label font-bold tracking-wider text-white">
                          {entry.badge}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {entry.title}
                        </span>
                        <span className="block truncate text-label text-ink-muted">
                          {entry.subtitle}
                        </span>
                      </span>
                      <CaretRight
                        aria-hidden="true"
                        className="shrink-0 text-ink-muted"
                        size={14}
                      />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-body text-ink-muted">
                Escriba al menos 2 caracteres para buscar por placa, cliente,
                producto o factura.
              </div>
            )
          ) : searchQuery.isError ? (
            <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
              <p className="font-semibold text-ink">
                No fue posible completar la búsqueda.
              </p>
              <Button
                onClick={() => void searchQuery.refetch()}
                variant="secondary"
              >
                Reintentar
              </Button>
            </div>
          ) : searchQuery.isFetching && !data ? (
            <div
              aria-live="polite"
              className="px-5 py-8 text-center text-body text-ink-muted"
            >
              Buscando…
            </div>
          ) : data && totalMatches === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-5 py-10 text-center text-ink-muted">
              <span className="font-semibold text-ink">
                Nada coincide con «{trimmed}»
              </span>
              <span className="text-label">
                Prueba con la placa sin guion o con parte del nombre.
              </span>
            </div>
          ) : (
            data && (
              <>
                {data.vehicles && data.vehicles.items.length > 0 && (
                  <section aria-label="Vehículos">
                    <div className="flex items-center gap-2 px-5 pt-3 pb-1.5 text-label font-semibold text-ink-muted">
                      <span>Vehículos</span>
                      <span className="inline-grid min-w-5 place-items-center rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-bold text-ink">
                        {data.vehicles.total}
                      </span>
                    </div>
                    {data.vehicles.items.map((v, idx) => {
                      const flatIdx = vehiclesOffset + idx
                      const option = flatOptions[flatIdx]!
                      const active = flatIdx === activeIndex
                      return (
                        <button
                          className={`mx-2 flex min-h-11 w-[calc(100%-1rem)] items-center gap-3 rounded-control px-3 py-2 text-left transition-colors ${
                            active ? 'bg-canvas' : 'hover:bg-canvas'
                          }`}
                          key={v.id}
                          onClick={() => choose(option)}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          type="button"
                        >
                          <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-graphite px-2 text-label font-bold tracking-wider text-white">
                            {v.plate}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {v.label}
                            </span>
                            {v.owner_name && (
                              <span className="block truncate text-label text-ink-muted">
                                {v.owner_name}
                              </span>
                            )}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-label font-semibold text-ink-muted">
                            {v.open_order ? 'En el taller' : 'Abrir ficha'}
                            <CaretRight aria-hidden="true" size={14} />
                          </span>
                        </button>
                      )
                    })}
                    {data.vehicles.total > data.vehicles.items.length && (
                      <p className="px-5 pt-1 text-label text-ink-muted">
                        Mostrando {data.vehicles.items.length} de{' '}
                        {data.vehicles.total} — afine la búsqueda.
                      </p>
                    )}
                  </section>
                )}

                {data.customers && data.customers.items.length > 0 && (
                  <section aria-label="Clientes">
                    <div className="flex items-center gap-2 px-5 pt-3 pb-1.5 text-label font-semibold text-ink-muted">
                      <span>Clientes</span>
                      <span className="inline-grid min-w-5 place-items-center rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-bold text-ink">
                        {data.customers.total}
                      </span>
                    </div>
                    {data.customers.items.map((c, idx) => {
                      const flatIdx = customersOffset + idx
                      const option = flatOptions[flatIdx]!
                      const active = flatIdx === activeIndex
                      return (
                        <button
                          className={`mx-2 flex min-h-11 w-[calc(100%-1rem)] items-center gap-3 rounded-control px-3 py-2 text-left transition-colors ${
                            active ? 'bg-canvas' : 'hover:bg-canvas'
                          }`}
                          key={c.id}
                          onClick={() => choose(option)}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="grid size-8 shrink-0 place-items-center rounded-full bg-graphite text-label font-bold text-white"
                          >
                            {initials(c.full_name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {c.full_name}
                            </span>
                            <span className="code block truncate text-label text-ink-muted">
                              {c.identification_type} {c.identification}
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-label font-semibold text-ink-muted">
                            Abrir ficha
                            <CaretRight aria-hidden="true" size={14} />
                          </span>
                        </button>
                      )
                    })}
                    {data.customers.total > data.customers.items.length && (
                      <p className="px-5 pt-1 text-label text-ink-muted">
                        Mostrando {data.customers.items.length} de{' '}
                        {data.customers.total} — afine la búsqueda.
                      </p>
                    )}
                  </section>
                )}

                {data.invoices && data.invoices.items.length > 0 && (
                  <section aria-label="Facturas">
                    <div className="flex items-center gap-2 px-5 pt-3 pb-1.5 text-label font-semibold text-ink-muted">
                      <span>Facturas</span>
                      <span className="inline-grid min-w-5 place-items-center rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-bold text-ink">
                        {data.invoices.total}
                      </span>
                    </div>
                    {data.invoices.items.map((inv, idx) => {
                      const flatIdx = invoicesOffset + idx
                      const option = flatOptions[flatIdx]!
                      const active = flatIdx === activeIndex
                      const business =
                        inv.entity === 'COMERCIAL'
                          ? commercialName
                          : artisanName
                      return (
                        <button
                          className={`mx-2 flex min-h-11 w-[calc(100%-1rem)] flex-wrap items-center gap-3 rounded-control px-3 py-2 text-left transition-colors sm:flex-nowrap ${
                            active ? 'bg-canvas' : 'hover:bg-canvas'
                          }`}
                          key={inv.id}
                          onClick={() => choose(option)}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="grid size-8 shrink-0 place-items-center rounded-control bg-canvas text-ink-muted"
                          >
                            <FileText size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="code block truncate font-semibold">
                              {inv.number ?? 'Sin número'}
                            </span>
                            <span className="block truncate text-label text-ink-muted">
                              {business}
                              {inv.customer_name
                                ? ` · ${inv.customer_name}`
                                : ''}
                              {inv.date ? ` · ${documentDate(inv.date)}` : ''}
                            </span>
                          </span>
                          <StatusBadge
                            label={STATE_LABELS[inv.state]}
                            tone={STATE_TONES[inv.state]}
                          />
                          {inv.total !== null && (
                            <Money
                              amount={inv.total}
                              className="min-w-14 text-right font-bold"
                            />
                          )}
                        </button>
                      )
                    })}
                    {data.invoices.total > data.invoices.items.length && (
                      <p className="px-5 pt-1 text-label text-ink-muted">
                        Mostrando {data.invoices.items.length} de{' '}
                        {data.invoices.total} — afine la búsqueda.
                      </p>
                    )}
                  </section>
                )}

                {data.products && data.products.items.length > 0 && (
                  <section aria-label="Productos">
                    <div className="flex items-center gap-2 px-5 pt-3 pb-1.5 text-label font-semibold text-ink-muted">
                      <span>Productos</span>
                      <span className="inline-grid min-w-5 place-items-center rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-bold text-ink">
                        {data.products.total}
                      </span>
                    </div>
                    {data.products.items.map((p, idx) => {
                      const flatIdx = productsOffset + idx
                      const option = flatOptions[flatIdx]!
                      const active = flatIdx === activeIndex
                      return (
                        <button
                          className={`mx-2 flex min-h-11 w-[calc(100%-1rem)] flex-wrap items-center gap-3 rounded-control px-3 py-2 text-left transition-colors sm:flex-nowrap ${
                            active ? 'bg-canvas' : 'hover:bg-canvas'
                          }`}
                          key={p.id}
                          onClick={() => choose(option)}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="grid size-8 shrink-0 place-items-center rounded-control bg-canvas text-ink-muted"
                          >
                            <Package size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {p.name}
                            </span>
                            <span className="code block truncate text-label text-ink-muted">
                              Código {p.code}
                            </span>
                          </span>
                          {p.stock !== null && (
                            <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-0.5 text-label font-semibold text-ink-muted">
                              Quedan {p.stock}
                            </span>
                          )}
                          <Money
                            amount={p.sale_price}
                            className="min-w-14 text-right font-bold"
                          />
                        </button>
                      )
                    })}
                    {data.products.total > data.products.items.length && (
                      <p className="px-5 pt-1 text-label text-ink-muted">
                        Mostrando {data.products.items.length} de{' '}
                        {data.products.total} — afine la búsqueda.
                      </p>
                    )}
                  </section>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}

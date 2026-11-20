import { FileText, Flask } from '@phosphor-icons/react'
import { Link } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { usePreparation, usePreparationList } from '@/features/fiscal/hooks'
import type {
  FiscalSourceKind,
  PreparationEntity,
  PreparationListRow,
  PreparationLocalState,
} from '@/features/fiscal/types'
import { documentDate } from '@/features/maintenance/format'
import { useBusinessName, useIssuerBrand } from '@/shared/api/entity-logos'
import {
  BusinessMark,
  ElevatedDataList,
  HintPopover,
  Money,
  PageHeader,
  SegmentedControl,
  SkeletonRows,
  StatusBadge,
} from '@/shared/ui'

/** Textos del estado local: ninguno afirma envío, autorización ni emisión ante el SRI. */
const STATE_LABELS: Record<PreparationLocalState, string> = {
  DRAFT: 'Borrador',
  PREPARED: 'Preparada, sin enviar',
  CANCELLED: 'Cancelada',
}
const STATE_TONES = {
  DRAFT: 'neutral',
  PREPARED: 'info',
  CANCELLED: 'warning',
} as const

/** De dónde sale la factura: cada negocio factura un solo tipo de documento. */
const SOURCE_LABELS: Record<FiscalSourceKind, string> = {
  COMMERCIAL: 'Venta de repuestos',
  ARTISAN: 'Servicios del taller',
}

function entityScope(entity: PreparationEntity) {
  return entity === 'COMERCIAL' ? 'commercial' : 'artesanal'
}

function BusinessCell({ entity }: { entity: PreparationEntity }) {
  const brand = useIssuerBrand(entity)
  const name = useBusinessName(entityScope(entity))
  return (
    <BusinessMark
      logoUrl={brand.logoUrl}
      name={name}
      scope={entityScope(entity)}
      size="md"
    />
  )
}

function StateBadge({ state }: { state: PreparationLocalState }) {
  return <StatusBadge label={STATE_LABELS[state]} tone={STATE_TONES[state]} />
}

const rowDate = (row: PreparationListRow) =>
  documentDate(row.source_date ?? row.created_at.slice(0, 10))

/**
 * Detalle de la factura elegida: cliente, líneas y total de la preparación local. No ofrece
 * PDF ni reenvío: la emisión real no está habilitada y ninguna factura está autorizada.
 */
function InvoicePreview({ row }: { row: PreparationListRow }) {
  const detail = usePreparation(row.id)
  const business = useBusinessName(entityScope(row.entity))
  const receiver = detail.data?.working?.receiver
  const lines = detail.data?.summary?.lines ?? []
  return (
    <aside
      aria-label="Detalle de la factura"
      className="min-w-0 flex-[1_1_20rem] self-start overflow-hidden rounded-card border border-line bg-surface"
    >
      <div className="border-b border-line bg-surface-subtle px-5 py-4">
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-label font-bold text-ink-muted">
            Factura de {business}
          </span>
          <StateBadge state={row.state} />
        </div>
        <p className="code mt-1.5 text-figure font-bold">
          {row.number ?? 'Sin número'}
        </p>
        <p className="text-label text-ink-muted">
          {rowDate(row)} · {SOURCE_LABELS[row.source_kind]}
        </p>
      </div>
      <div className="flex flex-col gap-3.5 px-5 py-4">
        <div className="leading-snug">
          <div className="text-label font-medium text-ink-muted">Cliente</div>
          <div className="font-bold">
            {receiver?.legal_name || row.customer_name || '—'}
          </div>
          {receiver?.identification && (
            <div className="code text-label text-ink-muted">
              {receiver.identification}
            </div>
          )}
          {receiver?.email && (
            <div className="text-label text-ink-muted">{receiver.email}</div>
          )}
        </div>
        {detail.isPending ? (
          <SkeletonRows rows={2} />
        ) : (
          lines.length > 0 && (
            <ul className="flex flex-col gap-2 border-t border-line pt-3">
              {lines.map((line) => (
                <li
                  className="flex justify-between gap-2.5 text-body"
                  key={line.position}
                >
                  <span className="min-w-0">
                    {line.description}
                    {Number(line.quantity) !== 1 && (
                      <span className="text-ink-muted">
                        {' '}
                        × {Number(line.quantity)}
                      </span>
                    )}
                  </span>
                  <Money amount={line.total} className="font-semibold" />
                </li>
              ))}
            </ul>
          )
        )}
        <div className="flex items-end justify-between border-t border-line pt-3">
          <span className="text-label font-medium text-ink-muted">Total</span>
          <Money
            amount={row.total}
            className="text-page leading-none font-light tracking-tight"
          />
        </div>
        <Link
          className="ui-button inline-flex min-h-11 items-center justify-center rounded-control border border-ink px-4 text-body font-semibold text-ink hover:bg-ink hover:text-white"
          to={`/fiscal/preparations/${row.id}`}
        >
          Abrir la factura
        </Link>
      </div>
    </aside>
  )
}

/**
 * Facturas de los negocios que el usuario puede consultar: segmentos por estado y por negocio,
 * la lista y, a la derecha, el detalle de la elegida. Mientras la emisión real no esté
 * habilitada, son preparaciones locales: ninguna está solicitada ni autorizada por el SRI.
 */
export function InvoicesPage() {
  const filters = useUrlFilters()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canCommercial = permissions.has('fiscal.comercial.ver')
  const canArtisan = permissions.has('fiscal.artesanal.ver')
  const commercialName = useBusinessName('commercial')
  const artisanName = useBusinessName('artesanal')

  const entityParam = filters.get('entity')
  const entity: PreparationEntity | undefined =
    (entityParam === 'COMERCIAL' && canCommercial) ||
    (entityParam === 'ARTESANAL' && canArtisan)
      ? entityParam
      : undefined
  const stateParam = filters.get('state')
  const state: PreparationLocalState | undefined =
    stateParam === 'DRAFT' ||
    stateParam === 'PREPARED' ||
    stateParam === 'CANCELLED'
      ? stateParam
      : undefined
  const selectedId = filters.get('selected')

  const query = usePreparationList({ entity, state, page: filters.page })
  const rows = query.data?.results ?? []
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0]

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        actions={
          <HintPopover
            align="end"
            label="Facturación de prueba"
            trigger={
              <span className="inline-flex items-center gap-1.5">
                <Flask aria-hidden="true" size={16} />
                Facturación de prueba
              </span>
            }
            variant="button"
          >
            Las facturas se preparan en el sistema, pero todavía no se envían al
            SRI. Ninguna está autorizada hasta activar la emisión real.
          </HintPopover>
        }
        description="Las facturas preparadas de cada negocio, con su estado y de dónde vienen."
        icon={<FileText />}
        {...(canCommercial && canArtisan
          ? { eyebrow: 'Los dos negocios' }
          : {})}
        title="Facturas"
      />
      <ListStates
        emptyText="Todavía no hay facturas. Cuando prepare una desde una venta o un servicio, aparecerá aquí. Hoy el sistema no emite facturas autorizadas por el SRI."
        emptyTitle="No hay facturas"
        errorText="No fue posible consultar las facturas. Reintente en unos instantes."
        filtered={Boolean(entity || state)}
        loadingLabel="Cargando facturas…"
        onPage={(page) => filters.set({ page })}
        query={query}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              aria-label="Estado de la factura"
              onChange={(value) => filters.set({ state: value, selected: '' })}
              options={[
                { value: '', label: 'Todas' },
                ...(Object.keys(STATE_LABELS) as PreparationLocalState[]).map(
                  (value) => ({ value, label: STATE_LABELS[value] }),
                ),
              ]}
              value={state ?? ''}
            />
            {canCommercial && canArtisan && (
              <SegmentedControl
                aria-label="Negocio"
                onChange={(value) =>
                  filters.set({ entity: value, selected: '' })
                }
                options={[
                  { value: '', label: 'Los dos' },
                  { value: 'ARTESANAL', label: artisanName },
                  { value: 'COMERCIAL', label: commercialName },
                ]}
                value={entity ?? ''}
              />
            )}
          </div>
        }
      >
        {(list) => (
          <div className="flex flex-wrap items-start gap-5">
            <div className="min-w-0 flex-[999_1_34rem]">
              <ElevatedDataList<PreparationListRow>
                columns={[
                  {
                    header: 'Negocio',
                    key: 'entity',
                    priority: 'secondary',
                    render: (row) => <BusinessCell entity={row.entity} />,
                  },
                  {
                    header: 'Número y cliente',
                    key: 'number',
                    priority: 'primary',
                    render: (row) => (
                      <span className="leading-snug">
                        <Link
                          className="code block font-bold text-ink hover:text-accent hover:underline"
                          onClick={(event) => event.stopPropagation()}
                          to={`/fiscal/preparations/${row.id}`}
                        >
                          {row.number ?? 'Sin número'}
                        </Link>
                        <span className="text-label text-ink-muted">
                          {row.customer_name ?? '—'} · {rowDate(row)}
                        </span>
                      </span>
                    ),
                  },
                  {
                    header: 'Viene de',
                    key: 'source_kind',
                    priority: 'secondary',
                    render: (row) => SOURCE_LABELS[row.source_kind],
                  },
                  {
                    header: 'Estado',
                    key: 'state',
                    priority: 'primary',
                    render: (row) => <StateBadge state={row.state} />,
                  },
                  {
                    header: 'Total',
                    key: 'total',
                    priority: 'secondary',
                    align: 'end',
                    render: (row) => (
                      <Money amount={row.total} className="font-bold" />
                    ),
                  },
                ]}
                getRowKey={(row) => row.id}
                label="Facturas"
                onRowClick={(row) =>
                  filters.set({ selected: row.id, page: filters.page })
                }
                rows={list}
              />
            </div>
            {selected && <InvoicePreview key={selected.id} row={selected} />}
          </div>
        )}
      </ListStates>
    </div>
  )
}

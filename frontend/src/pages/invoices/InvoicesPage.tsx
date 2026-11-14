import { FileText } from '@phosphor-icons/react'
import { Link } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { usePreparationList } from '@/features/fiscal/hooks'
import type {
  PreparationEntity,
  PreparationListRow,
  PreparationLocalState,
} from '@/features/fiscal/types'
import { documentDate } from '@/features/maintenance/format'
import { useBusinessName } from '@/shared/api/entity-logos'
import {
  ElevatedDataList,
  Field,
  FilterPanel,
  Money,
  PageHeader,
  SegmentedControl,
  Select,
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

function entityScope(entity: PreparationEntity) {
  return entity === 'COMERCIAL' ? 'commercial' : 'artesanal'
}

function BusinessCell({ entity }: { entity: PreparationEntity }) {
  const name = useBusinessName(entityScope(entity))
  return <span className="font-medium text-ink">{name}</span>
}

/**
 * Lista de solo lectura de las preparaciones locales de factura de los negocios que el usuario
 * puede consultar. Mientras la emisión real no esté habilitada, no hay facturas autorizadas.
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

  const query = usePreparationList({ entity, state, page: filters.page })

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        description="Facturas preparadas en el sistema. Todavía no se emiten facturas autorizadas por el SRI: aquí solo se ven las preparaciones locales."
        icon={<FileText />}
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
          <div className="flex flex-wrap items-end gap-3">
            <SegmentedControl
              aria-label="Estado de la factura"
              onChange={(value) => filters.set({ state: value })}
              options={[
                { value: '', label: 'Todas' },
                ...(Object.keys(STATE_LABELS) as PreparationLocalState[]).map(
                  (value) => ({ value, label: STATE_LABELS[value] }),
                ),
              ]}
              value={state ?? ''}
            />
            {canCommercial && canArtisan && (
              <FilterPanel bare label="Filtros de facturas" layout="inline">
                <Field id="invoice-entity" label="Negocio">
                  <Select
                    id="invoice-entity"
                    onChange={(event) =>
                      filters.set({ entity: event.target.value })
                    }
                    value={entity ?? ''}
                  >
                    <option value="">Todos</option>
                    <option value="COMERCIAL">{commercialName}</option>
                    <option value="ARTESANAL">{artisanName}</option>
                  </Select>
                </Field>
              </FilterPanel>
            )}
          </div>
        }
      >
        {(rows) => (
          <ElevatedDataList<PreparationListRow>
            columns={[
              {
                header: 'Negocio',
                key: 'entity',
                priority: 'primary',
                render: (row) => <BusinessCell entity={row.entity} />,
              },
              {
                header: 'Número',
                key: 'number',
                priority: 'primary',
                render: (row) => (
                  <Link
                    className="code font-semibold text-ink hover:text-accent hover:underline"
                    to={`/fiscal/preparations/${row.id}`}
                  >
                    {row.number ?? 'Sin número'}
                  </Link>
                ),
              },
              {
                header: 'Cliente',
                key: 'customer_name',
                priority: 'secondary',
                render: (row) => row.customer_name ?? '—',
              },
              {
                header: 'Total',
                key: 'total',
                priority: 'secondary',
                align: 'end',
                render: (row) => <Money amount={row.total} />,
              },
              {
                header: 'Fecha',
                key: 'created_at',
                priority: 'secondary',
                render: (row) =>
                  documentDate(row.source_date ?? row.created_at.slice(0, 10)),
              },
              {
                header: 'Estado',
                key: 'state',
                priority: 'primary',
                render: (row) => (
                  <StatusBadge
                    label={STATE_LABELS[row.state]}
                    tone={STATE_TONES[row.state]}
                  />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Facturas"
            rows={rows}
          />
        )}
      </ListStates>
    </div>
  )
}

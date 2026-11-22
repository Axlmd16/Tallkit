import {
  DotsThreeVertical,
  Eye,
  NotePencil,
  FileText,
} from '@phosphor-icons/react'
import { useLocation, useNavigate } from 'react-router'

import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { documentDate, ProformaStateBadge } from '@/features/proformas/format'
import { useProformas } from '@/features/proformas/hooks'
import {
  type ProformaState,
  type ProformaSummary,
} from '@/features/proformas/types'
import {
  SalesActions,
  SalesOverview,
  SalesTabs,
} from '@/features/sales/SalesOverview'
import { useIssuerBrand } from '@/shared/api/entity-logos'
import {
  DropdownMenu,
  ElevatedDataList,
  IconButton,
  Money,
  PageHeader,
  SearchInput,
  SegmentedControl,
} from '@/shared/ui'

/** Estados como filtros de la lista, en plural. */
const SEGMENT_LABELS: Record<ProformaState, string> = {
  DRAFT: 'Borradores',
  VALID: 'Vigentes',
  EXPIRED: 'Vencidas',
  CONVERTED: 'Convertidas',
  VOIDED: 'Anuladas',
}

/** Vigentes que vencen hoy o mañana: el mismo corte que muestra el inicio. */
const EXPIRING = 'EXPIRING'
const EXPIRING_DAYS = 1

/** Lista de proformas con búsqueda y estado en la URL, que se conservan al volver. */
export function ProformasPage() {
  const filters = useUrlFilters()
  const location = useLocation()
  const navigate = useNavigate()
  const business = useIssuerBrand('COMERCIAL').displayName
  const state = filters.get('state') as ProformaState | ''
  const expiring = filters.get('expires_within_days') !== ''
  const query = useProformas({
    search: filters.search || undefined,
    state: state || undefined,
    expiresWithinDays: expiring
      ? Number(filters.get('expires_within_days')) || 0
      : undefined,
    page: filters.page,
  })
  const open = (row: ProformaSummary) =>
    navigate(`/proformas/${row.id}`, { state: { from: location.search } })

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        icon={<FileText />}
        actions={<SalesActions />}
        description="Presupuestos que aún esperan respuesta. No reservan inventario ni crean deuda."
        {...(business ? { eyebrow: business } : {})}
        title="Proformas"
      />
      <SalesOverview />
      <SalesTabs active="proformas" />
      <ListStates
        emptyText="Aún no hay proformas registradas."
        emptyTitle="No hay proformas"
        errorText="No fue posible consultar las proformas. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando proformas…"
        onPage={(page) => filters.set({ page })}
        query={query}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              aria-label="Estado de la proforma"
              onChange={(value) =>
                filters.set(
                  value === EXPIRING
                    ? { state: 'VALID', expires_within_days: EXPIRING_DAYS }
                    : { state: value, expires_within_days: '' },
                )
              }
              options={[
                { value: '', label: 'Todas' },
                { value: EXPIRING, label: 'Por vencer' },
                ...(Object.keys(SEGMENT_LABELS) as ProformaState[]).map(
                  (value) => ({ value, label: SEGMENT_LABELS[value] }),
                ),
              ]}
              value={expiring ? EXPIRING : state}
            />
            <div className="min-w-[220px] flex-1">
              <SearchInput
                aria-label="Buscar proformas"
                onChange={(event) =>
                  filters.set({ search: event.target.value })
                }
                placeholder="Número o cliente"
                value={filters.search}
              />
            </div>
          </div>
        }
      >
        {(rows) => (
          <ElevatedDataList<ProformaSummary>
            actions={(row) => (
              <DropdownMenu
                items={[
                  {
                    id: 'view',
                    label: 'Ver proforma',
                    icon: <Eye aria-hidden="true" size={16} />,
                    onClick: () => open(row),
                  },
                  ...(row.allowed_actions.includes('edit')
                    ? [
                        {
                          id: 'edit',
                          label: 'Editar borrador',
                          icon: <NotePencil aria-hidden="true" size={16} />,
                          onClick: () => navigate(`/proformas/${row.id}/edit`),
                        },
                      ]
                    : []),
                ]}
                trigger={
                  <IconButton
                    icon={<DotsThreeVertical size={20} weight="bold" />}
                    label={`Acciones de ${row.internal_number || 'proforma sin número'}`}
                  />
                }
              />
            )}
            columns={[
              {
                header: 'Número',
                key: 'internal_number',
                priority: 'primary',
                render: (row) =>
                  row.internal_number ? (
                    <span className="code font-medium text-ink">
                      {row.internal_number}
                    </span>
                  ) : (
                    <span className="text-ink-muted">Sin número</span>
                  ),
              },
              {
                header: 'Cliente',
                key: 'customer',
                priority: 'secondary',
                render: (row) =>
                  row.customer?.name ?? (
                    <span className="text-ink-muted">Sin cliente</span>
                  ),
              },
              {
                header: 'Emisión',
                key: 'issue_date',
                priority: 'secondary',
                render: (row) =>
                  row.issue_date ? documentDate(row.issue_date) : '—',
              },
              {
                header: 'Vigente hasta',
                key: 'valid_until',
                priority: 'secondary',
                render: (row) =>
                  row.valid_until ? documentDate(row.valid_until) : '—',
              },
              {
                header: 'Estado',
                key: 'state',
                priority: 'secondary',
                render: (row) => <ProformaStateBadge state={row.state} />,
              },
              {
                header: 'Venta',
                key: 'sale',
                priority: 'secondary',
                render: (row) =>
                  row.sale ? (
                    <span className="code text-body">
                      {row.sale.internal_number ?? 'Borrador'}
                    </span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  ),
              },
              {
                header: 'Total USD',
                key: 'grand_total',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.grand_total} className="font-semibold" />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Proformas"
            onRowClick={open}
            rows={rows}
          />
        )}
      </ListStates>
    </div>
  )
}

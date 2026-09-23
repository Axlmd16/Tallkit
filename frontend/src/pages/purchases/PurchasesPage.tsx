import { DotsThreeVertical, Eye, NotePencil, Plus } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { documentDate, PurchaseStateBadge } from '@/features/purchases/format'
import { usePurchases } from '@/features/purchases/hooks'
import {
  documentTypeLabels,
  type PurchaseState,
  type PurchaseSummary,
} from '@/features/purchases/types'
import {
  Button,
  DropdownMenu,
  ElevatedDataList,
  Field,
  FilterPanel,
  IconButton,
  Input,
  Money,
  PageHeader,
  SegmentedControl,
} from '@/shared/ui'

/** Estados como filtros de la lista, en plural. */
const SEGMENT_LABELS: Record<PurchaseState, string> = {
  DRAFT: 'Borradores',
  CONFIRMED: 'Confirmados',
  VOIDED: 'Anulados',
}

/** Lista de ingresos de mercadería con filtros en la URL que se conservan al volver de la ficha. */
export function PurchasesPage() {
  const filters = useUrlFilters()
  const navigate = useNavigate()
  const location = useLocation()
  const canCreate = new Set(useSession().data?.permissions ?? []).has(
    'ingresos.crear',
  )
  const [text, setText] = useState(filters.search)
  useEffect(() => setText(filters.search), [filters.search])

  const state = filters.get('state') as PurchaseState | ''
  const query = usePurchases({
    search: filters.search || undefined,
    supplierId: filters.getNumber('supplier_id'),
    state: state || undefined,
    dateFrom: filters.get('date_from') || undefined,
    dateTo: filters.get('date_to') || undefined,
    page: filters.page,
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    filters.set({ search: text.trim() })
  }

  const openDetail = (row: PurchaseSummary) =>
    navigate(`/purchases/${row.id}`, {
      state: { from: `${location.pathname}${location.search}` },
    })

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        actions={
          canCreate && (
            <Button onClick={() => navigate('/purchases/new')} type="button">
              <Plus aria-hidden="true" size={16} />
              Nuevo ingreso
            </Button>
          )
        }
        description="Ingresos de mercadería del RUC comercial. Confirmar un ingreso recibe sus líneas en la bodega y actualiza existencias y costo promedio."
        title="Ingresos de mercadería"
      />
      <ListStates
        toolbar={
          <>
            <SegmentedControl
              aria-label="Estado del ingreso"
              onChange={(value) => filters.set({ state: value })}
              options={[
                { value: '', label: 'Todos' },
                ...(Object.keys(SEGMENT_LABELS) as PurchaseState[]).map(
                  (value) => ({ value, label: SEGMENT_LABELS[value] }),
                ),
              ]}
              value={state}
            />
            <FilterPanel
              bare
              className="mt-3"
              label="Filtros de ingresos"
              layout="inline"
              {...(filters.filtered
                ? {
                    onClear: () =>
                      filters.set({
                        search: '',
                        state: '',
                        supplier_id: '',
                        date_from: '',
                        date_to: '',
                      }),
                  }
                : {})}
            >
              <form className="contents" onSubmit={submit} role="search">
                <Field
                  id="purchase-search"
                  label="Número, referencia o proveedor"
                >
                  <Input
                    id="purchase-search"
                    onChange={(event) => setText(event.target.value)}
                    placeholder="COM-ING, factura o proveedor…"
                    value={text}
                  />
                </Field>
                <Button type="submit" variant="secondary">
                  Buscar
                </Button>
              </form>
              <Field id="purchase-date-from" label="Fecha documental desde">
                <Input
                  id="purchase-date-from"
                  onChange={(event) =>
                    filters.set({ date_from: event.target.value })
                  }
                  type="date"
                  value={filters.get('date_from')}
                />
              </Field>
              <Field id="purchase-date-to" label="Fecha documental hasta">
                <Input
                  id="purchase-date-to"
                  onChange={(event) =>
                    filters.set({ date_to: event.target.value })
                  }
                  type="date"
                  value={filters.get('date_to')}
                />
              </Field>
            </FilterPanel>
          </>
        }
        emptyText="Aún no hay ingresos de mercadería registrados."
        emptyTitle="No hay ingresos"
        errorText="No fue posible consultar los ingresos. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando ingresos…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<PurchaseSummary>
            actions={(row) => (
              <DropdownMenu
                items={[
                  {
                    id: 'view',
                    label: 'Ver ingreso',
                    icon: <Eye aria-hidden="true" size={16} />,
                    onClick: () => openDetail(row),
                  },
                  ...(row.state === 'DRAFT' && canCreate
                    ? [
                        {
                          id: 'edit',
                          label: 'Editar borrador',
                          icon: <NotePencil aria-hidden="true" size={16} />,
                          onClick: () => navigate(`/purchases/${row.id}/edit`),
                        },
                      ]
                    : []),
                ]}
                trigger={
                  <IconButton
                    icon={<DotsThreeVertical size={20} weight="bold" />}
                    label={`Acciones de ${row.internal_number ?? 'ingreso sin número'}`}
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
                    <span className="font-mono font-medium text-ink">
                      {row.internal_number}
                    </span>
                  ) : (
                    <span className="text-ink-muted">Borrador</span>
                  ),
              },
              {
                header: 'Proveedor',
                key: 'supplier',
                priority: 'secondary',
                render: (row) => row.supplier.name ?? '—',
              },
              {
                header: 'Documento',
                key: 'document',
                priority: 'secondary',
                render: (row) => (
                  <>
                    {documentTypeLabels[row.document.type]}
                    {row.document.reference && (
                      <span className="ml-1 font-mono text-xs text-ink-muted">
                        {row.document.reference}
                      </span>
                    )}
                  </>
                ),
              },
              {
                header: 'Fecha documental',
                key: 'document_date',
                priority: 'secondary',
                render: (row) => documentDate(row.document_date),
              },
              {
                header: 'Estado',
                key: 'state',
                priority: 'secondary',
                render: (row) => <PurchaseStateBadge state={row.state} />,
              },
              {
                header: 'Total USD',
                key: 'total',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.total} className="font-semibold" />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Ingresos de mercadería"
            onRowClick={openDetail}
            rows={rows}
          />
        )}
      </ListStates>
    </div>
  )
}

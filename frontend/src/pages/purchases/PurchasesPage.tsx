import {
  CalendarBlank,
  CurrencyDollar,
  Plus,
  Receipt,
  Storefront,
} from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  documentDate,
  PurchaseStateBadge,
  usd,
} from '@/features/purchases/format'
import { usePurchases } from '@/features/purchases/hooks'
import {
  documentTypeLabels,
  purchaseStateLabels,
  type PurchaseState,
  type PurchaseSummary,
} from '@/features/purchases/types'
import {
  Button,
  Drawer,
  ElevatedDataList,
  Field,
  FilterPanel,
  FiscalScopeBadge,
  Input,
  PageHeader,
  Select,
} from '@/shared/ui'

export function PurchasesPage() {
  const filters = useUrlFilters()
  const navigate = useNavigate()
  const canCreate = new Set(useSession().data?.permissions ?? []).has(
    'ingresos.crear',
  )
  const [text, setText] = useState(filters.search)
  const [previewing, setPreviewing] = useState<PurchaseSummary | null>(null)
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

  return (
    <div className="catalog-page list-page space-y-6">
      <PageHeader
        actions={
          canCreate && (
            <Button onClick={() => navigate('/purchases/new')} type="button">
              <Plus aria-hidden="true" size={16} />
              Nuevo ingreso
            </Button>
          )
        }
        description="Ingresos de mercadería del ámbito comercial. Confirmar un ingreso recibe todas sus líneas en la bodega y actualiza existencias y costo promedio."
        title="Ingresos de mercadería"
      />
      <FiscalScopeBadge scope="commercial" />
      <FilterPanel
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
          <Field id="purchase-search" label="Número, referencia o proveedor">
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
        <Field id="purchase-state" label="Estado">
          <Select
            id="purchase-state"
            onChange={(event) => filters.set({ state: event.target.value })}
            value={state}
          >
            <option value="">Todos</option>
            {(Object.keys(purchaseStateLabels) as PurchaseState[]).map(
              (value) => (
                <option key={value} value={value}>
                  {purchaseStateLabels[value]}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Field id="purchase-date-from" label="Fecha documental desde">
          <Input
            id="purchase-date-from"
            onChange={(event) => filters.set({ date_from: event.target.value })}
            type="date"
            value={filters.get('date_from')}
          />
        </Field>
        <Field id="purchase-date-to" label="Fecha documental hasta">
          <Input
            id="purchase-date-to"
            onChange={(event) => filters.set({ date_to: event.target.value })}
            type="date"
            value={filters.get('date_to')}
          />
        </Field>
      </FilterPanel>
      <ListStates
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
            columns={[
              {
                header: 'Número interno',
                key: 'internal_number',
                priority: 'primary',
                render: (row) => (
                  <span className="flex items-center gap-2.5 font-semibold text-ink">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-soft text-cyan">
                      <Receipt aria-hidden="true" size={17} weight="fill" />
                    </span>
                    {row.internal_number ?? 'Borrador'}
                  </span>
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
                render: (row) =>
                  `${documentTypeLabels[row.document.type]}${row.document.reference ? ` ${row.document.reference}` : ''}`,
              },
              {
                header: 'Fecha documental',
                key: 'document_date',
                priority: 'secondary',
                render: (row) => documentDate(row.document_date),
              },
              {
                header: 'Total',
                key: 'total',
                priority: 'secondary',
                render: (row) => usd(row.total),
              },
              {
                header: 'Estado',
                key: 'state',
                priority: 'secondary',
                render: (row) => <PurchaseStateBadge state={row.state} />,
              },
            ]}
            getRowKey={(row) => row.id}
            label="Ingresos de mercadería"
            onRowClick={setPreviewing}
            rows={rows}
          />
        )}
      </ListStates>
      <Drawer
        className="record-preview-drawer"
        description="Resumen del ingreso seleccionado."
        onClose={() => setPreviewing(null)}
        open={previewing !== null}
        title="Detalle del ingreso"
        width="409"
      >
        {previewing && (
          <div className="record-preview-content space-y-7">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-20 place-items-center rounded-full bg-cyan-soft text-cyan">
                <Receipt aria-hidden="true" size={38} weight="duotone" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-ink">
                {previewing.internal_number ?? 'Ingreso en borrador'}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">RUC comercial</p>
              <div className="mt-3">
                <PurchaseStateBadge state={previewing.state} />
              </div>
            </div>
            <section aria-labelledby="purchase-preview-details">
              <h3
                className="text-base font-bold text-ink"
                id="purchase-preview-details"
              >
                Información del ingreso
              </h3>
              <div className="preview-detail-list">
                <div>
                  <Storefront size={19} />
                  <span>Proveedor</span>
                  <strong>{previewing.supplier.name || 'No registrado'}</strong>
                </div>
                <div>
                  <Receipt size={19} />
                  <span>Documento</span>
                  <strong>
                    {documentTypeLabels[previewing.document.type]}{' '}
                    {previewing.document.reference}
                  </strong>
                </div>
                <div>
                  <CalendarBlank size={19} />
                  <span>Fecha documental</span>
                  <strong>{documentDate(previewing.document_date)}</strong>
                </div>
                <div>
                  <CurrencyDollar size={19} />
                  <span>Total</span>
                  <strong>{usd(previewing.total)}</strong>
                </div>
              </div>
            </section>
            <Link
              className="preview-primary-link"
              to={`/purchases/${previewing.id}`}
            >
              Ver ficha completa
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  )
}

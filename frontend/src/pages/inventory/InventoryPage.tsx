import {
  ChartLineUp,
  Cube,
  CurrencyDollar,
  Package,
  Plus,
  Tag,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { AdjustmentDrawer } from '@/features/inventory/AdjustmentDrawer'
import { useStock } from '@/features/inventory/hooks'
import type { StockRow } from '@/features/inventory/types'
import { useProductCategoryList } from '@/features/product-categories/hooks'
import {
  Button,
  Drawer,
  ElevatedDataList,
  Field,
  FilterPanel,
  InlineNotice,
  Input,
  PageHeader,
  RowActions,
  Select,
  StatusBadge,
} from '@/shared/ui'

interface FlatRow {
  id: number
  label: string
  category: string
  presentation: string
  quantity: string
  average_cost: string | undefined
  inventory_value: string | undefined
  is_active: boolean
}

const flatten = (row: StockRow): FlatRow => ({
  id: row.product.id,
  label: `${row.product.code} — ${row.product.name}`,
  category: row.product.category.name,
  presentation: `${row.product.content_quantity} ${row.product.unit.symbol || row.product.unit.name}`,
  quantity: row.quantity,
  average_cost: row.average_cost,
  inventory_value: row.inventory_value,
  is_active: row.product.is_active,
})

export function InventoryPage() {
  const filters = useUrlFilters()
  const navigate = useNavigate()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canAdjust = permissions.has('inventario.ajustar')
  const canSeeValuation = permissions.has('inventario.ver_valorizacion')
  const [text, setText] = useState(filters.search)
  useEffect(() => setText(filters.search), [filters.search])
  const [adjusting, setAdjusting] = useState(false)
  const [previewing, setPreviewing] = useState<FlatRow | null>(null)
  const adjustTrigger = useRef<HTMLButtonElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const categories = useProductCategoryList({ isActive: 'all', pageSize: 100 })

  const query = useStock({
    search: filters.search || undefined,
    categoryId: filters.getNumber('category_id'),
    // Sin filtro de estado: activos más inactivos con historia o saldo.
    isActive: (filters.get('active') || undefined) as
      | 'true'
      | 'false'
      | 'all'
      | undefined,
    stock: (filters.get('stock') || undefined) as
      | 'all'
      | 'positive'
      | 'zero'
      | undefined,
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
          canAdjust && (
            <Button
              onClick={() => {
                setNotice(null)
                setAdjusting(true)
              }}
              ref={adjustTrigger}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Carga inicial o ajuste
            </Button>
          )
        }
        description="Existencias por presentación completa en la bodega única. El cero es una existencia confirmada; no hay umbrales ni alertas en esta versión."
        title="Inventario"
      />
      {notice && (
        <InlineNotice title="Operación exitosa" tone="success">
          {notice}
        </InlineNotice>
      )}
      {canSeeValuation && (
        <p className="text-sm text-ink-muted">
          El costo promedio es un costo de compra valorado por el sistema; no es
          el precio final de venta.
        </p>
      )}
      <FilterPanel
        label="Filtros de inventario"
        layout="inline"
        {...(filters.filtered
          ? {
              onClear: () =>
                filters.set({
                  search: '',
                  category_id: '',
                  active: '',
                  stock: '',
                }),
            }
          : {})}
      >
        <form className="contents" onSubmit={submit} role="search">
          <Field
            id="inventory-search"
            label="Código, código de fabricante o nombre"
          >
            <Input
              id="inventory-search"
              onChange={(event) => setText(event.target.value)}
              value={text}
            />
          </Field>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <Field id="inventory-category" label="Categoría">
          <Select
            id="inventory-category"
            onChange={(event) =>
              filters.set({ category_id: event.target.value })
            }
            value={filters.get('category_id')}
          >
            <option value="">Todas</option>
            {categories.data?.results.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="inventory-active" label="Estado del producto">
          <Select
            id="inventory-active"
            onChange={(event) => filters.set({ active: event.target.value })}
            value={filters.get('active')}
          >
            <option value="">Activos e inactivos con historia</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
            <option value="all">Todos</option>
          </Select>
        </Field>
        <Field id="inventory-stock" label="Existencias">
          <Select
            id="inventory-stock"
            onChange={(event) => filters.set({ stock: event.target.value })}
            value={filters.get('stock')}
          >
            <option value="">Todas</option>
            <option value="positive">Con existencia</option>
            <option value="zero">Sin existencia (cero)</option>
          </Select>
        </Field>
      </FilterPanel>
      <ListStates
        emptyText="Aún no hay productos con existencias registradas."
        emptyTitle="No hay productos"
        errorText="No fue posible consultar las existencias. No se muestra ningún saldo hasta reintentar."
        filtered={filters.filtered}
        loadingLabel="Cargando existencias…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<FlatRow>
            actions={(row) => (
              <RowActions>
                <Button
                  aria-label="Ver Kardex"
                  className="record-action"
                  onClick={() =>
                    navigate(`/inventory/products/${row.id}/kardex`)
                  }
                  type="button"
                  title="Ver Kardex"
                  variant="quiet"
                >
                  <ChartLineUp aria-hidden="true" size={18} />
                  <span>Kardex</span>
                </Button>
              </RowActions>
            )}
            columns={[
              {
                header: 'Producto',
                key: 'label',
                priority: 'primary',
                render: (row) => (
                  <span className="flex items-center gap-2.5 font-semibold text-ink">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info-soft text-info">
                      <Package aria-hidden="true" size={17} weight="fill" />
                    </span>
                    {row.label}
                  </span>
                ),
              },
              {
                header: 'Categoría',
                key: 'category',
                priority: 'secondary',
                render: (row) => row.category,
              },
              {
                header: 'Presentación',
                key: 'presentation',
                priority: 'secondary',
                render: (row) => row.presentation,
              },
              {
                header: 'Existencia',
                key: 'quantity',
                priority: 'primary',
                render: (row) =>
                  row.quantity === '0' ? (
                    <span>
                      0 <StatusBadge label="Sin existencia" tone="neutral" />
                    </span>
                  ) : (
                    <strong>{row.quantity}</strong>
                  ),
              },
              ...(canSeeValuation
                ? [
                    {
                      header: 'Costo promedio',
                      key: 'average_cost' as const,
                      priority: 'secondary' as const,
                      render: (row: FlatRow) =>
                        row.average_cost !== undefined
                          ? `USD ${row.average_cost}`
                          : '—',
                    },
                    {
                      header: 'Valor inventariable',
                      key: 'inventory_value' as const,
                      priority: 'secondary' as const,
                      render: (row: FlatRow) =>
                        row.inventory_value !== undefined
                          ? `USD ${row.inventory_value}`
                          : '—',
                    },
                  ]
                : []),
              {
                header: 'Estado',
                key: 'is_active',
                priority: 'secondary',
                render: (row) => (
                  <StatusBadge
                    label={row.is_active ? 'Activo' : 'Inactivo'}
                    tone={row.is_active ? 'success' : 'neutral'}
                  />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Existencias"
            onRowClick={setPreviewing}
            rows={rows.map(flatten)}
          />
        )}
      </ListStates>
      <Drawer
        className="record-preview-drawer"
        description="Resumen de existencias del producto seleccionado."
        onClose={() => setPreviewing(null)}
        open={previewing !== null}
        title="Detalle de inventario"
        width="409"
      >
        {previewing && (
          <div className="record-preview-content space-y-7">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-20 place-items-center rounded-full bg-info-soft text-info">
                <Package aria-hidden="true" size={38} weight="duotone" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-ink">
                {previewing.label}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">Bodega única</p>
              <div className="mt-3">
                <StatusBadge
                  label={previewing.is_active ? 'Activo' : 'Inactivo'}
                  tone={previewing.is_active ? 'success' : 'neutral'}
                />
              </div>
            </div>
            <section aria-labelledby="inventory-preview-details">
              <h3
                className="text-base font-bold text-ink"
                id="inventory-preview-details"
              >
                Existencias y presentación
              </h3>
              <div className="preview-detail-list">
                <div>
                  <Package size={19} />
                  <span>Existencia actual</span>
                  <strong className="text-lg">{previewing.quantity}</strong>
                </div>
                <div>
                  <Cube size={19} />
                  <span>Presentación</span>
                  <strong>{previewing.presentation}</strong>
                </div>
                <div>
                  <Tag size={19} />
                  <span>Categoría</span>
                  <strong>{previewing.category}</strong>
                </div>
                {canSeeValuation && (
                  <div>
                    <CurrencyDollar size={19} />
                    <span>Valor inventariable</span>
                    <strong>
                      {previewing.inventory_value
                        ? `USD ${previewing.inventory_value}`
                        : '—'}
                    </strong>
                  </div>
                )}
              </div>
            </section>
            <div className="flex flex-wrap gap-2">
              <Link
                className="preview-primary-link"
                to={`/inventory/products/${previewing.id}/kardex`}
              >
                <ChartLineUp aria-hidden="true" size={18} /> Ver Kardex
              </Link>
              <Link
                className="preview-secondary-link"
                to={`/products/${previewing.id}`}
              >
                Ver producto
              </Link>
            </div>
          </div>
        )}
      </Drawer>
      {canAdjust && (
        <AdjustmentDrawer
          onClose={() => setAdjusting(false)}
          onDone={(message) => {
            setAdjusting(false)
            setNotice(message)
          }}
          open={adjusting}
          returnFocusRef={adjustTrigger}
        />
      )}
    </div>
  )
}

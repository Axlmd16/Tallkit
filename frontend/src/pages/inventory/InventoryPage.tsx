import { ChartLineUp, Plus } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import { AdjustmentModal } from '@/features/inventory/AdjustmentModal'
import { useStock } from '@/features/inventory/hooks'
import type { StockRow } from '@/features/inventory/types'
import { useProductCategoryList } from '@/features/product-categories/hooks'
import {
  Button,
  ElevatedDataList,
  Field,
  FilterPanel,
  Input,
  PageHeader,
  RowActions,
  SegmentedControl,
  Select,
  StatusBadge,
  StockIndicator,
  useToast,
} from '@/shared/ui'

interface FlatRow {
  id: number
  code: string
  name: string
  category: string
  presentation: string
  quantity: string
  reserved: string
  available: string
  average_cost: string | undefined
  inventory_value: string | undefined
  is_active: boolean
}

const flatten = (row: StockRow): FlatRow => ({
  id: row.product.id,
  code: row.product.code,
  name: row.product.name,
  category: row.product.category.name,
  presentation: `${row.product.content_quantity} ${row.product.unit.symbol || row.product.unit.name}`,
  quantity: row.quantity,
  reserved: row.reserved,
  available: row.available,
  average_cost: row.average_cost,
  inventory_value: row.inventory_value,
  is_active: row.product.is_active,
})

export function InventoryPage() {
  const filters = useUrlFilters()
  const navigate = useNavigate()
  const location = useLocation()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canAdjust = permissions.has('inventario.ajustar')
  const canSeeValuation = permissions.has('inventario.ver_valorizacion')
  const [text, setText] = useState(filters.search)
  useEffect(() => setText(filters.search), [filters.search])
  const [adjusting, setAdjusting] = useState(false)
  const adjustTrigger = useRef<HTMLButtonElement>(null)
  const toast = useToast()
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
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        actions={
          canAdjust && (
            <Button
              onClick={() => setAdjusting(true)}
              ref={adjustTrigger}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Carga inicial o ajuste
            </Button>
          )
        }
        description={`Existencias por presentación completa en la bodega única. El cero es una existencia confirmada; no hay umbrales ni alertas en esta versión.${canSeeValuation ? ' El costo promedio es un costo de compra valorado por el sistema; no es el precio final de venta.' : ''}`}
        title="Inventario"
      />
      <ListStates
        toolbar={
          <>
            <SegmentedControl
              aria-label="Existencias"
              onChange={(value) => filters.set({ stock: value })}
              options={[
                { value: '', label: 'Todas' },
                { value: 'positive', label: 'Con existencia' },
                { value: 'zero', label: 'Agotadas' },
              ]}
              value={filters.get('stock')}
            />
            <FilterPanel
              bare
              className="mt-3"
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
                  onChange={(event) =>
                    filters.set({ active: event.target.value })
                  }
                  value={filters.get('active')}
                >
                  <option value="">Activos e inactivos con historia</option>
                  <option value="true">Solo activos</option>
                  <option value="false">Solo inactivos</option>
                  <option value="all">Todos</option>
                </Select>
              </Field>
            </FilterPanel>
          </>
        }
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
                key: 'name',
                priority: 'primary',
                render: (row) => (
                  <span className="block min-w-0">
                    <span className="block font-mono text-xs font-semibold text-ink">
                      {row.code}
                    </span>
                    <span className="block truncate font-medium text-ink">
                      {row.name}
                    </span>
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
                align: 'end',
                render: (row) => <StockIndicator quantity={row.quantity} />,
              },
              {
                header: 'Reservado',
                key: 'reserved',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <span className="tabular-nums">{row.reserved}</span>
                ),
              },
              {
                header: 'Disponible',
                key: 'available',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <span className="tabular-nums font-medium">
                    {row.available}
                  </span>
                ),
              },
              ...(canSeeValuation
                ? [
                    {
                      header: 'Costo promedio',
                      key: 'average_cost' as const,
                      priority: 'secondary' as const,
                      align: 'end' as const,
                      render: (row: FlatRow) =>
                        row.average_cost !== undefined ? (
                          <span className="tabular-nums">{`USD ${row.average_cost}`}</span>
                        ) : (
                          '—'
                        ),
                    },
                    {
                      header: 'Valor inventariable',
                      key: 'inventory_value' as const,
                      priority: 'secondary' as const,
                      align: 'end' as const,
                      render: (row: FlatRow) =>
                        row.inventory_value !== undefined ? (
                          <span className="tabular-nums">{`USD ${row.inventory_value}`}</span>
                        ) : (
                          '—'
                        ),
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
            onRowClick={(row) =>
              navigate(`/inventory/products/${row.id}/kardex`, {
                state: { from: `${location.pathname}${location.search}` },
              })
            }
            rows={rows.map(flatten)}
          />
        )}
      </ListStates>
      {canAdjust && (
        <AdjustmentModal
          onClose={() => setAdjusting(false)}
          onDone={(message) => {
            setAdjusting(false)
            toast.success(message)
          }}
          open={adjusting}
          returnFocusRef={adjustTrigger}
        />
      )}
    </div>
  )
}

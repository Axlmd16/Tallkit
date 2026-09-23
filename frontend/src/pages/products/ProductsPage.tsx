import { DotsThreeVertical, PencilSimple, Power } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  CatalogToolbar,
  NewRecordButton,
} from '@/features/catalog-common/CatalogToolbar'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { useMeasurementUnitList } from '@/features/measurement-units/hooks'
import { useProductBrandList } from '@/features/product-brands/hooks'
import { useProductCategoryList } from '@/features/product-categories/hooks'
import { presentation } from '@/features/products/format'
import { useProductMutations, useProducts } from '@/features/products/hooks'
import type { Product } from '@/features/products/types'
import { useVehicleBrands } from '@/features/vehicle-brands/hooks'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  DropdownMenu,
  ElevatedDataList,
  IconButton,
  Money,
  Field,
  PageHeader,
  Select,
  useToast,
  StatusBadge,
} from '@/shared/ui'

const PICKER = { isActive: 'all', pageSize: 100 } as const

export function ProductsPage() {
  const filters = useUrlFilters()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canManage = permissions.has('productos.gestionar')
  const canDeactivate = permissions.has('productos.desactivar')
  const tracker = useIntentTracker()
  const mutations = useProductMutations()

  const navigate = useNavigate()
  const toast = useToast()
  const [change, setChange] = useState<StateChange | null>(null)

  const categoryId = filters.getNumber('category_id')
  const productBrandId = filters.getNumber('product_brand_id')
  const vehicleBrandId = filters.getNumber('vehicle_brand_id')

  const query = useProducts({
    search: filters.search || undefined,
    isActive: filters.isActive,
    page: filters.page,
    categoryId,
    productBrandId,
    vehicleBrandId,
  })
  const categories = useProductCategoryList(PICKER)
  const productBrands = useProductBrandList(PICKER)
  const vehicleBrands = useVehicleBrands({ isActive: null, pageSize: 100 })
  // Precarga de unidades: el formulario las necesita al abrirse.
  useMeasurementUnitList({ isActive: 'true', pageSize: 100 })

  async function changeState(target: StateChange) {
    await tracker.run({ op: 'state', ...target }, (key) =>
      mutations.setActive.mutateAsync({
        id: target.id,
        active: target.active,
        expectedVersion: target.version,
        key,
      }),
    )
    toast.success(
      `Producto «${target.name}» ${target.active ? 'reactivado' : 'desactivado'}.`,
    )
  }

  const filterSelect = (
    id: string,
    label: string,
    param: string,
    value: number | undefined,
    options: Array<{ id: number; name: string; is_active: boolean }>,
  ) => (
    <div className="w-48">
      <Field id={id} label={label}>
        <Select
          id={id}
          onChange={(event) => filters.set({ [param]: event.target.value })}
          value={value ?? ''}
        >
          <option value="">Todas</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.is_active ? '' : ' (inactiva)'}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )

  return (
    <div className="catalog-page list-page space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <nav
              aria-label="Catálogos de apoyo"
              className="flex flex-wrap gap-3 text-[13px] font-semibold"
            >
              <Link
                className="text-accent hover:underline"
                to="/product-categories"
              >
                Categorías
              </Link>
              <Link
                className="text-accent hover:underline"
                to="/measurement-units"
              >
                Unidades
              </Link>
              <Link
                className="text-accent hover:underline"
                to="/product-brands"
              >
                Marcas de producto
              </Link>
            </nav>
            {canManage && (
              <NewRecordButton
                label="Nuevo producto"
                onClick={() => void navigate('/products/new')}
              />
            )}
          </div>
        }
        description="Repuestos vendibles con código, marca, existencias y precio final en USD."
        title="Productos"
      />
      <ListStates
        toolbar={
          <CatalogToolbar
            extraFilters={
              <>
                {filterSelect(
                  'product-filter-category',
                  'Categoría',
                  'category_id',
                  categoryId,
                  categories.data?.results ?? [],
                )}
                {filterSelect(
                  'product-filter-brand',
                  'Marca de producto',
                  'product_brand_id',
                  productBrandId,
                  productBrands.data?.results ?? [],
                )}
                {filterSelect(
                  'product-filter-vehicle',
                  'Marca de vehículo',
                  'vehicle_brand_id',
                  vehicleBrandId,
                  vehicleBrands.data?.results ?? [],
                )}
              </>
            }
            filters={filters}
            idPrefix="product"
            label="Barra de herramientas de productos"
            searchLabel="Buscar por código, código del fabricante o nombre"
            searchPlaceholder="Código, código del fabricante o nombre…"
            statusLabels={{ active: 'Activos', inactive: 'Inactivos' }}
          />
        }
        emptyText="Aún no hay productos registrados."
        emptyTitle="No hay productos"
        errorText="No fue posible consultar los productos. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando productos…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<Product>
            actions={(row) =>
              canManage || canDeactivate ? (
                <DropdownMenu
                  items={[
                    ...(canManage
                      ? [
                          {
                            id: 'edit',
                            label: 'Editar',
                            icon: <PencilSimple aria-hidden="true" size={16} />,
                            onClick: () =>
                              void navigate(`/products/${row.id}/edit`),
                          },
                        ]
                      : []),
                    ...(canDeactivate
                      ? [
                          {
                            id: 'state',
                            label: row.is_active ? 'Desactivar' : 'Reactivar',
                            destructive: row.is_active,
                            icon: <Power aria-hidden="true" size={16} />,
                            onClick: () =>
                              setChange({
                                id: row.id,
                                name: row.name,
                                version: row.version,
                                active: !row.is_active,
                              }),
                          },
                        ]
                      : []),
                  ]}
                  trigger={
                    <IconButton
                      icon={<DotsThreeVertical size={20} weight="bold" />}
                      label={`Acciones de ${row.code}`}
                    />
                  }
                />
              ) : null
            }
            columns={[
              {
                header: 'Código interno',
                key: 'code',
                priority: 'primary',
                render: (row) => (
                  <span className="font-mono font-medium">{row.code}</span>
                ),
              },
              {
                header: 'Código del fabricante',
                key: 'manufacturer_code',
                priority: 'secondary',
                render: (row) =>
                  row.manufacturer_code ? (
                    <span className="font-mono text-sm">
                      {row.manufacturer_code}
                    </span>
                  ) : (
                    '—'
                  ),
              },
              {
                header: 'Producto',
                key: 'name',
                priority: 'primary',
                render: (row) => (
                  <span className="font-medium text-ink">{row.name}</span>
                ),
              },
              {
                header: 'Categoría',
                key: 'category',
                priority: 'secondary',
                render: (row) => row.category?.name ?? '—',
              },
              {
                header: 'Presentación',
                key: 'content_quantity',
                priority: 'secondary',
                render: presentation,
              },
              {
                header: 'Marca',
                key: 'product_brand',
                priority: 'secondary',
                render: (row) => row.product_brand?.name ?? '—',
              },
              {
                header: 'Precio final USD',
                key: 'sale_price',
                priority: 'secondary',
                align: 'end',
                render: (row) => (
                  <Money amount={row.sale_price} className="font-semibold" />
                ),
              },
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
            label="Productos"
            onRowClick={(row) =>
              void navigate(`/products/${row.id}`, {
                state: { from: window.location.search },
              })
            }
            rows={rows}
          />
        )}
      </ListStates>

      <StateChangeDialog
        activateText={`¿Reactivar «${change?.name ?? ''}»? Exige que su categoría esté activa.`}
        change={change}
        deactivateText={`¿Desactivar «${change?.name ?? ''}»? Conserva su identidad y referencias, pero no se podrá seleccionar en operaciones nuevas.`}
        noun="producto"
        onClose={() => setChange(null)}
        onConfirm={changeState}
      />
    </div>
  )
}

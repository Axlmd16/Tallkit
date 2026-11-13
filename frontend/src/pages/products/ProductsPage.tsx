import {
  DotsThreeVertical,
  Package,
  PencilSimple,
  Power,
  Printer,
} from '@phosphor-icons/react'
import { useRef, useState, type MouseEvent } from 'react'
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
import { ProductLabelPrintModal } from '@/features/product-labels/ProductLabelPrintModal'
import { productsApi } from '@/features/products/api'
import { presentation } from '@/features/products/format'
import { useProductMutations, useProducts } from '@/features/products/hooks'
import type { Product, ProductLabelData } from '@/features/products/types'
import { useVehicleBrands } from '@/features/vehicle-brands/hooks'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  DropdownMenu,
  ElevatedDataList,
  Button,
  ConfirmationPanel,
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
  const [selectedProducts, setSelectedProducts] = useState(
    () => new Map<number, ProductLabelData>(),
  )
  const [pendingFilterChange, setPendingFilterChange] = useState<Record<
    string,
    string | number | undefined
  > | null>(null)
  const [toolbarKey, setToolbarKey] = useState(0)
  const [labelModalOpen, setLabelModalOpen] = useState(false)
  const [labelProducts, setLabelProducts] = useState<ProductLabelData[]>([])
  const [labelLoading, setLabelLoading] = useState(false)
  const [labelError, setLabelError] = useState<string | null>(null)
  const labelTriggerRef = useRef<HTMLElement | null>(null)

  const categoryId = filters.getNumber('category_id')
  const productBrandId = filters.getNumber('product_brand_id')
  const vehicleBrandId = filters.getNumber('vehicle_brand_id')
  // Solo quien gestiona productos puede corregir códigos; los demás no usan este filtro.
  const codeOverLimit = canManage && filters.get('code_over_limit') === 'true'

  const guardedFilters = {
    ...filters,
    set(changes: Record<string, string | number | undefined>) {
      const changesFilter = Object.keys(changes).some(
        (name) => name !== 'page' && name !== 'ficha',
      )
      if (changesFilter && selectedProducts.size > 0) {
        setPendingFilterChange(changes)
        return
      }
      filters.set(changes)
    },
  }

  const query = useProducts({
    search: filters.search || undefined,
    isActive: filters.isActive,
    page: filters.page,
    categoryId,
    productBrandId,
    vehicleBrandId,
    codeOverLimit: codeOverLimit || undefined,
  })
  const categories = useProductCategoryList(PICKER)
  const productBrands = useProductBrandList(PICKER)
  const vehicleBrands = useVehicleBrands({ isActive: null, pageSize: 100 })
  // Precarga de unidades: el formulario las necesita al abrirse.
  useMeasurementUnitList({ isActive: 'true', pageSize: 100 })

  function toLabelData(product: Product): ProductLabelData {
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      contentQuantity: product.content_quantity,
      manufacturerCode: product.manufacturer_code || null,
      productBrand: product.product_brand
        ? { id: product.product_brand.id, name: product.product_brand.name }
        : null,
      unit: product.unit
        ? { id: product.unit.id, name: product.unit.name }
        : null,
    }
  }

  function rememberTrigger(event: MouseEvent<HTMLButtonElement>) {
    labelTriggerRef.current = event.currentTarget
  }

  function openSelectedLabels(event: MouseEvent<HTMLButtonElement>) {
    rememberTrigger(event)
    setLabelProducts(Array.from(selectedProducts.values()))
    setLabelError(null)
    setLabelModalOpen(true)
  }

  async function loadFilteredLabels() {
    setLabelLoading(true)
    setLabelError(null)
    try {
      const result = await productsApi.labelData({
        search: filters.search || undefined,
        isActive: filters.isActive,
        categoryId,
        productBrandId,
        vehicleBrandId,
      })
      setLabelProducts(result)
      if (result.length === 0) {
        setLabelError('No hay productos en el filtro actual.')
      }
    } catch {
      setLabelError('No se pudieron cargar los productos del filtro actual.')
    } finally {
      setLabelLoading(false)
    }
  }

  function openFilteredLabels(event: MouseEvent<HTMLButtonElement>) {
    rememberTrigger(event)
    setLabelProducts([])
    setLabelModalOpen(true)
    void loadFilteredLabels()
  }

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
          onChange={(event) =>
            guardedFilters.set({ [param]: event.target.value })
          }
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
        icon={<Package />}
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <nav
              aria-label="Catálogos de apoyo"
              className="flex flex-wrap gap-3 text-body font-semibold"
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
                {canManage && (
                  <div className="w-48">
                    <Field id="product-filter-code" label="Código">
                      <Select
                        id="product-filter-code"
                        onChange={(event) =>
                          guardedFilters.set({
                            code_over_limit: event.target.value,
                          })
                        }
                        value={codeOverLimit ? 'true' : ''}
                      >
                        <option value="">Todos</option>
                        <option value="true">Excede 25 caracteres</option>
                      </Select>
                    </Field>
                  </div>
                )}
              </>
            }
            filters={guardedFilters}
            idPrefix="product"
            key={toolbarKey}
            label="Barra de herramientas de productos"
            searchLabel="Buscar por código, código del fabricante o nombre"
            searchPlaceholder="Código, código del fabricante o nombre…"
            statusLabels={{ active: 'Activos', inactive: 'Inactivos' }}
          />
        }
        emptyText={
          codeOverLimit
            ? 'Ningún producto tiene un código de más de 25 caracteres con los filtros aplicados.'
            : 'Aún no hay productos registrados.'
        }
        emptyTitle={
          codeOverLimit ? 'No hay códigos por corregir' : 'No hay productos'
        }
        errorText="No fue posible consultar los productos. Reintente en unos instantes."
        filtered={filters.filtered && !codeOverLimit}
        loadingLabel="Cargando productos…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <>
            <div
              aria-label="Acciones de etiquetas"
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-subtle px-3 py-2"
              role="toolbar"
            >
              <p
                className="text-label font-semibold text-ink-muted"
                aria-live="polite"
              >
                {selectedProducts.size}{' '}
                {selectedProducts.size === 1 ? 'seleccionado' : 'seleccionados'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={selectedProducts.size === 0}
                  onClick={openSelectedLabels}
                  variant="soft"
                >
                  <Printer aria-hidden="true" size={16} />
                  Imprimir etiquetas
                </Button>
                <Button
                  disabled={codeOverLimit}
                  onClick={openFilteredLabels}
                  title={
                    codeOverLimit
                      ? 'El filtro de códigos por corregir no se imprime.'
                      : undefined
                  }
                  variant="secondary"
                >
                  Todos los del filtro actual
                </Button>
              </div>
            </div>
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
                              icon: (
                                <PencilSimple aria-hidden="true" size={16} />
                              ),
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
                    <>
                      <span className="code font-medium">{row.code}</span>
                      {row.code_length !== undefined && (
                        <span className="block text-label text-ink-muted">
                          {row.code_length} caracteres
                        </span>
                      )}
                    </>
                  ),
                },
                {
                  header: 'Código del fabricante',
                  key: 'manufacturer_code',
                  priority: 'secondary',
                  render: (row) =>
                    row.manufacturer_code ? (
                      <span className="code text-body">
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
              onSelectAll={(selected) => {
                setSelectedProducts((current) => {
                  const next = new Map(current)
                  for (const row of rows) {
                    if (selected) next.set(row.id, toLabelData(row))
                    else next.delete(row.id)
                  }
                  return next
                })
              }}
              onSelectRow={(key, selected) => {
                const id = Number(key)
                const row = rows.find((candidate) => candidate.id === id)
                if (!row) return
                setSelectedProducts((current) => {
                  const next = new Map(current)
                  if (selected) next.set(id, toLabelData(row))
                  else next.delete(id)
                  return next
                })
              }}
              onRowClick={(row) =>
                void navigate(`/products/${row.id}`, {
                  state: { from: window.location.search },
                })
              }
              rows={rows}
              selectedKeys={new Set(selectedProducts.keys())}
            />
          </>
        )}
      </ListStates>

      <ConfirmationPanel
        confirmLabel="Cambiar filtros"
        description="La selección manual se limpiará para que no mezcle productos de filtros distintos."
        onCancel={() => {
          setPendingFilterChange(null)
          setToolbarKey((current) => current + 1)
        }}
        onConfirm={() => {
          const changes = pendingFilterChange
          setPendingFilterChange(null)
          setSelectedProducts(new Map())
          if (changes) filters.set(changes)
        }}
        open={pendingFilterChange !== null}
        title="Cambiar filtros"
      />

      <ProductLabelPrintModal
        loadError={labelError}
        loading={labelLoading}
        onClose={() => setLabelModalOpen(false)}
        onRetry={() => void loadFilteredLabels()}
        open={labelModalOpen}
        products={labelProducts}
        returnFocusRef={labelTriggerRef}
      />

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

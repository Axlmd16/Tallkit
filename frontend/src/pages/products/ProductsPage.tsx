import {
  Barcode,
  Cube,
  CurrencyDollar,
  Package,
  PencilSimple,
  Power,
  Tag,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { CatalogToolbar } from '@/features/catalog-common/CatalogToolbar'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { useMeasurementUnitList } from '@/features/measurement-units/hooks'
import { useProductBrandList } from '@/features/product-brands/hooks'
import { useProductCategoryList } from '@/features/product-categories/hooks'
import { presentation, usd } from '@/features/products/format'
import { useProductMutations, useProducts } from '@/features/products/hooks'
import { ProductEditorDrawer } from '@/features/products/ProductEditorDrawer'
import type { Product } from '@/features/products/types'
import { useVehicleBrands } from '@/features/vehicle-brands/hooks'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Drawer,
  ElevatedDataList,
  Field,
  FiscalScopeBadge,
  InlineNotice,
  PageHeader,
  RowActions,
  Select,
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

  const [editor, setEditor] = useState<'new' | Product | null>(null)
  const [previewing, setPreviewing] = useState<Product | null>(null)
  const [change, setChange] = useState<StateChange | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
    setNotice(
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
          <nav
            aria-label="Catálogos de apoyo"
            className="flex flex-wrap gap-2 text-sm font-semibold"
          >
            <Link className="text-primary underline" to="/product-categories">
              Categorías
            </Link>
            <Link className="text-primary underline" to="/measurement-units">
              Unidades
            </Link>
            <Link className="text-primary underline" to="/product-brands">
              Marcas de producto
            </Link>
          </nav>
        }
        description="Catálogo de productos por presentación completa, con precio final de venta en USD. Las existencias y costos se consultan en Inventario."
        title="Productos"
      />
      <FiscalScopeBadge scope="commercial" />

      {notice && (
        <InlineNotice title="Operación exitosa" tone="success">
          {notice}
        </InlineNotice>
      )}

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
        newLabel="Nuevo producto"
        onNew={
          canManage
            ? () => {
                setNotice(null)
                setEditor('new')
              }
            : undefined
        }
        searchLabel="Buscar por código, código del fabricante o nombre"
        searchPlaceholder="Código, código del fabricante o nombre…"
        statusLabels={{ active: 'Activos', inactive: 'Inactivos' }}
      />

      <ListStates
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
            actions={(row) => (
              <RowActions>
                {canManage && (
                  <Button
                    aria-label="Editar"
                    className="record-action"
                    onClick={() => {
                      setNotice(null)
                      setEditor(row)
                    }}
                    type="button"
                    title="Editar"
                    variant="quiet"
                  >
                    <PencilSimple aria-hidden="true" size={18} />
                    <span>Editar</span>
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    aria-label={row.is_active ? 'Desactivar' : 'Reactivar'}
                    className="record-action"
                    onClick={() =>
                      setChange({
                        id: row.id,
                        name: row.name,
                        version: row.version,
                        active: !row.is_active,
                      })
                    }
                    type="button"
                    title={row.is_active ? 'Desactivar' : 'Reactivar'}
                    variant={row.is_active ? 'danger' : 'secondary'}
                  >
                    <Power aria-hidden="true" size={18} />
                    <span>{row.is_active ? 'Desactivar' : 'Reactivar'}</span>
                  </Button>
                )}
              </RowActions>
            )}
            columns={[
              {
                header: 'Código interno',
                key: 'code',
                priority: 'primary',
                render: (row) => (
                  <span className="font-mono text-sm font-semibold">
                    {row.code}
                  </span>
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
                header: 'Nombre',
                key: 'name',
                priority: 'primary',
                render: (row) => (
                  <span className="flex items-center gap-2.5 font-semibold text-ink">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                      <Package aria-hidden="true" size={17} weight="fill" />
                    </span>
                    {row.name}
                  </span>
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
                header: 'Precio final',
                key: 'sale_price',
                priority: 'secondary',
                render: (row) => (
                  <span className="numeric">{usd(row.sale_price)}</span>
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
            onRowClick={setPreviewing}
            rows={rows}
          />
        )}
      </ListStates>

      <Drawer
        className="record-preview-drawer"
        description="Resumen del producto seleccionado."
        onClose={() => setPreviewing(null)}
        open={previewing !== null}
        title="Detalle del producto"
        width="409"
      >
        {previewing && (
          <div className="record-preview-content space-y-7">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-20 place-items-center rounded-full bg-primary-soft text-primary">
                <Package aria-hidden="true" size={38} weight="duotone" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-ink">
                {previewing.name}
              </h3>
              <p className="mt-1 text-sm font-semibold text-ink-muted">
                {previewing.code}
              </p>
              <div className="mt-3">
                <StatusBadge
                  label={previewing.is_active ? 'Activo' : 'Inactivo'}
                  tone={previewing.is_active ? 'success' : 'neutral'}
                />
              </div>
            </div>

            <section aria-labelledby="product-preview-details">
              <h3
                className="text-base font-bold text-ink"
                id="product-preview-details"
              >
                Información del producto
              </h3>
              <div className="preview-detail-list">
                <div>
                  <Barcode size={19} />
                  <span>Código fabricante</span>
                  <strong>
                    {previewing.manufacturer_code || 'No registrado'}
                  </strong>
                </div>
                <div>
                  <Tag size={19} />
                  <span>Categoría</span>
                  <strong>
                    {previewing.category?.name || 'Sin categoría'}
                  </strong>
                </div>
                <div>
                  <Cube size={19} />
                  <span>Presentación</span>
                  <strong>{presentation(previewing)}</strong>
                </div>
                <div>
                  <CurrencyDollar size={19} />
                  <span>Precio final</span>
                  <strong>{usd(previewing.sale_price)}</strong>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Link
                className="preview-primary-link"
                to={`/products/${previewing.id}`}
              >
                Ver ficha completa
              </Link>
              {canManage && (
                <Button
                  onClick={() => {
                    setEditor(previewing)
                    setPreviewing(null)
                  }}
                  variant="secondary"
                >
                  <PencilSimple aria-hidden="true" size={18} />
                  Editar producto
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ProductEditorDrawer
        mode={editor}
        onClose={() => setEditor(null)}
        onSaved={setNotice}
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

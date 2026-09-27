import {
  ArrowLeft,
  ClockCounterClockwise,
  CurrencyDollar,
  Pencil,
  Power,
  Printer,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { TaxLine } from '@/features/catalog-common/TaxLine'
import { useStockItem } from '@/features/inventory/hooks'
import { ProductLabelPrintModal } from '@/features/product-labels/ProductLabelPrintModal'
import { useProduct, useProductMutations } from '@/features/products/hooks'
import { inventoryAmount } from '@/features/products/format'
import { ProductDetails } from '@/features/products/ProductDetails'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  InlineNotice,
  LoadingState,
  Money,
  SectionPanel,
  StatusBadge,
  useToast,
} from '@/shared/ui'

export function ProductDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const back = `/products${(location.state as { from?: string } | null)?.from ?? ''}`
  const permissions = new Set(useSession().data?.permissions ?? [])
  const query = useProduct(Number.isFinite(id) ? id : null)
  const mutations = useProductMutations()
  const tracker = useIntentTracker()
  const navigate = useNavigate()
  const toast = useToast()
  const [change, setChange] = useState<StateChange | null>(null)
  const [labelModalOpen, setLabelModalOpen] = useState(false)
  const labelTriggerRef = useRef<HTMLButtonElement>(null)
  const product = query.data
  const canSeeStock = permissions.has('inventario.ver')
  const canSeeOrders = permissions.has('mantenimientos.ver')
  const canSeeSales = permissions.has('ventas.ver')
  const stock = useStockItem(product?.id ?? null, canSeeStock)

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

  const notFound =
    query.error instanceof ProblemError && query.error.status === 404
  const backLink = (
    <Link
      aria-label="Volver a productos"
      className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
      title="Volver a productos"
      to={back}
    >
      <ArrowLeft aria-hidden="true" size={18} />
    </Link>
  )

  if (!product) {
    return (
      <div className="space-y-4">
        {backLink}
        {query.isPending && <LoadingState label="Cargando producto…" />}
        {query.isError && (
          <InlineNotice
            title={notFound ? 'Producto no encontrado' : 'Error de carga'}
            tone="danger"
          >
            {notFound
              ? 'El producto no existe o fue retirado.'
              : 'No fue posible consultar el producto. Reintente en unos instantes.'}
          </InlineNotice>
        )}
      </div>
    )
  }

  const exhausted =
    stock.data !== undefined && /^0+(?:\.0+)?$/.test(stock.data.quantity)

  return (
    <div className="catalog-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {backLink}
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">Productos</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] leading-7 font-semibold break-words text-ink">
                {product.name}
              </h1>
              <StatusBadge
                label={product.is_active ? 'Activo' : 'Inactivo'}
                tone={product.is_active ? 'success' : 'neutral'}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {permissions.has('productos.ver') && (
            <Button
              onClick={() => setLabelModalOpen(true)}
              ref={labelTriggerRef}
              type="button"
              variant="soft"
            >
              <Printer aria-hidden="true" size={15} />
              Imprimir etiquetas
            </Button>
          )}
          {permissions.has('productos.gestionar') && (
            <Button
              onClick={() => void navigate(`/products/${product.id}/edit`)}
              type="button"
              variant="secondary"
            >
              <Pencil aria-hidden="true" size={15} />
              Editar
            </Button>
          )}
          {permissions.has('productos.desactivar') && (
            <Button
              onClick={() =>
                setChange({
                  id: product.id,
                  name: product.name,
                  version: product.version,
                  active: !product.is_active,
                })
              }
              type="button"
              variant={product.is_active ? 'danger' : 'primary'}
            >
              <Power aria-hidden="true" size={15} />
              {product.is_active ? 'Desactivar' : 'Reactivar'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <ProductDetails product={product} />
        </div>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SectionPanel
            icon={<CurrencyDollar size={17} />}
            id="product-sale"
            title={canSeeStock ? 'Precio y existencias' : 'Precio'}
          >
            <div className="space-y-2 p-4">
              <p className="text-xs text-ink-muted">Precio final</p>
              <Money
                amount={product.sale_price}
                className="text-2xl leading-8 font-semibold text-ink"
              />
              <TaxLine scope="commercial" tax={product.tax} />
            </div>
            {canSeeStock && (
              <section
                aria-label="Existencias"
                className="space-y-3 border-t border-line p-4 text-[13px]"
              >
                {stock.isPending && (
                  <LoadingState label="Consultando existencias…" />
                )}
                {stock.isError && (
                  <InlineNotice
                    title="No se pudieron consultar las existencias"
                    tone="danger"
                  >
                    No se muestra ningún saldo hasta reintentar.{' '}
                    <Button
                      onClick={() => void stock.refetch()}
                      type="button"
                      variant="secondary"
                    >
                      Reintentar
                    </Button>
                  </InlineNotice>
                )}
                {stock.data && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-ink">
                        Existencia actual:{' '}
                        <strong className="text-base tabular-nums">
                          {stock.data.quantity}
                        </strong>{' '}
                        presentaciones completas.
                      </p>
                      {exhausted && (
                        <StatusBadge label="Agotado" tone="danger" />
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-xs text-ink-muted">Reservado</dt>
                        <dd className="mt-0.5 font-medium text-ink tabular-nums">
                          {stock.data.reserved}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-muted">Disponible</dt>
                        <dd className="mt-0.5 font-medium text-ink tabular-nums">
                          {stock.data.available}
                        </dd>
                      </div>
                    </dl>
                    {(stock.data.reservations ?? []).length > 0 && (
                      <div>
                        <p className="text-xs text-ink-muted">
                          Reservas de mantenimiento (no descuentan existencia):
                        </p>
                        <ul className="mt-1 space-y-1 text-[13px]">
                          {(stock.data.reservations ?? []).map(
                            (reservation) => (
                              <li
                                className="flex justify-between gap-3"
                                key={`${reservation.sale_id}-${reservation.order_id}-${reservation.quantity}`}
                              >
                                {reservation.order_id &&
                                (canSeeOrders || canSeeSales) ? (
                                  <Link
                                    className="font-mono hover:underline"
                                    to={
                                      canSeeOrders
                                        ? `/maintenance/${reservation.order_id}?tab=parts`
                                        : `/maintenance/${reservation.order_id}/commercial`
                                    }
                                  >
                                    {reservation.order_number ??
                                      `Orden ${reservation.order_id}`}
                                  </Link>
                                ) : (
                                  <span className="font-mono">
                                    {reservation.order_number ??
                                      `Orden ${reservation.order_id ?? '—'}`}
                                  </span>
                                )}
                                <span className="tabular-nums">
                                  {reservation.quantity}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                    {stock.data.average_cost !== undefined && (
                      <>
                        <dl className="grid grid-cols-2 gap-3">
                          <div>
                            <dt className="text-xs text-ink-muted">
                              Costo promedio
                            </dt>
                            <dd className="mt-0.5 font-medium text-ink tabular-nums">
                              {inventoryAmount(stock.data.average_cost)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-ink-muted">
                              Valor inventariable
                            </dt>
                            <dd className="mt-0.5 font-medium text-ink tabular-nums">
                              {inventoryAmount(stock.data.inventory_value)}
                            </dd>
                          </div>
                        </dl>
                        <p className="rounded-control bg-surface-subtle px-3 py-2 text-xs text-ink-muted">
                          Es un costo de compra: no es el precio final de venta.
                        </p>
                      </>
                    )}
                  </>
                )}
              </section>
            )}
            {canSeeStock && (
              <div className="border-t border-line p-4">
                <Link
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-control border border-line bg-surface text-sm font-semibold text-ink hover:bg-surface-subtle"
                  state={{ from: `/products/${product.id}` }}
                  to={`/inventory/products/${product.id}/kardex`}
                >
                  <ClockCounterClockwise aria-hidden="true" size={16} />
                  Ver Kardex del producto
                </Link>
              </div>
            )}
          </SectionPanel>
        </aside>
      </div>

      <StateChangeDialog
        activateText="¿Reactivar el producto? Exige que su categoría esté activa."
        change={change}
        deactivateText="¿Desactivar el producto? Conserva su identidad y referencias, pero no se podrá seleccionar en operaciones nuevas."
        noun="producto"
        onClose={() => setChange(null)}
        onConfirm={changeState}
      />

      <ProductLabelPrintModal
        onClose={() => setLabelModalOpen(false)}
        open={labelModalOpen}
        products={[
          {
            id: product.id,
            code: product.code,
            name: product.name,
            manufacturerCode: product.manufacturer_code || null,
            productBrand: product.product_brand
              ? {
                  id: product.product_brand.id,
                  name: product.product_brand.name,
                }
              : null,
          },
        ]}
        returnFocusRef={labelTriggerRef}
      />
    </div>
  )
}

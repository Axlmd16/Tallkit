import { ArrowLeft, Pencil, Power } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { useStockItem } from '@/features/inventory/hooks'
import { useProduct, useProductMutations } from '@/features/products/hooks'
import { ProductDetails } from '@/features/products/ProductDetails'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  InlineNotice,
  LoadingState,
  PageHeader,
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
  const product = query.data
  const canSeeStock = permissions.has('inventario.ver')
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

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
        to={back}
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Volver a productos
      </Link>
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
      {product && (
        <>
          <PageHeader
            actions={
              <div className="flex flex-wrap gap-2">
                {permissions.has('productos.gestionar') && (
                  <Button
                    onClick={() =>
                      void navigate(`/products/${product.id}/edit`)
                    }
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
            }
            description={`Código interno ${product.code}${product.manufacturer_code ? ` · Fabricante ${product.manufacturer_code}` : ''}`}
            title={product.name}
          />
          <ProductDetails product={product} />
          {canSeeStock && (
            <section
              aria-label="Existencias"
              className="space-y-2 rounded-group bg-surface p-4 shadow-card"
            >
              <h2 className="text-lg font-semibold text-ink">Existencias</h2>
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
                  <p className="text-ink">
                    Existencia actual: <strong>{stock.data.quantity}</strong>{' '}
                    presentaciones completas.
                  </p>
                  {stock.data.average_cost !== undefined && (
                    <p className="text-sm text-ink-muted">
                      Costo promedio USD {stock.data.average_cost} · valor
                      inventariable USD {stock.data.inventory_value}. Es un
                      costo de compra: no es el precio final de venta.
                    </p>
                  )}
                </>
              )}
              <Link
                className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline"
                state={{ from: `/products/${product.id}` }}
                to={`/inventory/products/${product.id}/kardex`}
              >
                Ver Kardex del producto
              </Link>
            </section>
          )}
          <StateChangeDialog
            activateText="¿Reactivar el producto? Exige que su categoría esté activa."
            change={change}
            deactivateText="¿Desactivar el producto? Conserva su identidad y referencias, pero no se podrá seleccionar en operaciones nuevas."
            noun="producto"
            onClose={() => setChange(null)}
            onConfirm={changeState}
          />
        </>
      )}
    </div>
  )
}

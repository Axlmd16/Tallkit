import { ArrowLeft, Pencil, Power } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { useProduct, useProductMutations } from '@/features/products/hooks'
import { ProductDetails } from '@/features/products/ProductDetails'
import { ProductEditorDrawer } from '@/features/products/ProductEditorDrawer'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import { Button, InlineNotice, LoadingState, PageHeader } from '@/shared/ui'

export function ProductDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const back = `/products${(location.state as { from?: string } | null)?.from ?? ''}`
  const permissions = new Set(useSession().data?.permissions ?? [])
  const query = useProduct(Number.isFinite(id) ? id : null)
  const mutations = useProductMutations()
  const tracker = useIntentTracker()
  const [editing, setEditing] = useState(false)
  const [change, setChange] = useState<StateChange | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const product = query.data

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

  const notFound =
    query.error instanceof ProblemError && query.error.status === 404

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
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
                    onClick={() => setEditing(true)}
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
          {notice && (
            <InlineNotice title="Operación exitosa" tone="success">
              {notice}
            </InlineNotice>
          )}
          <ProductDetails product={product} />
          <ProductEditorDrawer
            mode={editing ? product : null}
            onClose={() => setEditing(false)}
            onSaved={setNotice}
          />
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

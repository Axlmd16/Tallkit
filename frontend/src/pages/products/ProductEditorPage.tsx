import { ArrowLeft } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'

import { useProduct, useProductMutations } from '@/features/products/hooks'
import { ProductForm } from '@/features/products/ProductForm'
import type { ProductInput } from '@/features/products/types'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Dialog,
  InlineNotice,
  LoadingState,
  StatusBadge,
  useToast,
} from '@/shared/ui'

/**
 * Formulario de producto en página completa (PPF-03): el formulario tiene secciones, así que
 * no cabe en un modal. Advierte antes de abandonar con cambios y, al guardar, lleva a la
 * ficha con una notificación temporal. Reintenta con la misma clave de idempotencia.
 */
export function ProductEditorPage() {
  const { id } = useParams()
  const productId = id ? Number(id) : null
  const navigate = useNavigate()
  const toast = useToast()
  const tracker = useIntentTracker()
  const mutations = useProductMutations()
  const detail = useProduct(productId)
  const product = productId ? detail.data : undefined
  const [dirty, setDirty] = useState(false)
  // Una ref, no estado: al guardar se navega antes del siguiente render.
  const leaving = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !leaving.current &&
      currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const backTo = productId ? `/products/${productId}` : '/products'

  function leave(to: string) {
    leaving.current = true
    setDirty(false)
    void navigate(to)
  }

  async function save(data: Partial<ProductInput>) {
    if (!product) {
      const saved = await tracker.run({ op: 'create', data }, (key) =>
        mutations.create.mutateAsync({ data, key }),
      )
      toast.success(`Producto «${saved.name}» creado.`, {
        href: `/products/${saved.id}`,
        linkLabel: 'Ver',
      })
      leave(`/products/${saved.id}`)
      return
    }
    if (Object.keys(data).length === 0) {
      leave(backTo)
      return
    }
    const body = { ...data, expected_version: product.version }
    const saved = await tracker.run(
      { op: 'update', id: product.id, body },
      (key) =>
        mutations.update.mutateAsync({ id: product.id, data: body, key }),
    )
    toast.success(`Producto «${saved.name}» actualizado.`)
    leave(`/products/${saved.id}`)
  }

  if (productId && detail.isPending) {
    return <LoadingState label="Cargando producto…" />
  }
  if (productId && (detail.isError || !product)) {
    return (
      <InlineNotice title="No se pudo cargar el producto" tone="danger">
        Vuelva a la lista e inténtelo de nuevo.
      </InlineNotice>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label={product ? 'Volver a la ficha' : 'Volver a productos'}
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title={product ? 'Volver a la ficha' : 'Volver a productos'}
          to={backTo}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Productos</p>
          <h1 className="text-[22px] leading-7 font-semibold text-ink">
            {product ? `Editar ${product.name}` : 'Nuevo producto'}
          </h1>
        </div>
        {dirty && <StatusBadge label="Sin guardar" tone="warning" />}
      </div>
      <ProductForm
        key={product ? `edit-${product.id}-${product.version}` : 'new'}
        onCancel={() => leave(backTo)}
        onDirtyChange={setDirty}
        onReload={() => void detail.refetch()}
        onSubmit={save}
        product={product}
      />
      <Dialog
        description="Si sale ahora, perderá los datos que no ha guardado."
        onClose={() => blocker.reset?.()}
        open={blocker.state === 'blocked'}
        title="Hay cambios sin guardar"
        tone="danger"
      >
        <Button onClick={() => blocker.reset?.()} variant="secondary">
          Seguir editando
        </Button>
        <Button
          data-autofocus
          onClick={() => blocker.proceed?.()}
          variant="danger-solid"
        >
          Descartar cambios
        </Button>
      </Dialog>
    </div>
  )
}

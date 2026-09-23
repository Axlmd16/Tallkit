import { ArrowLeft } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'

import { SupplierForm } from '@/features/suppliers/SupplierForm'
import { useSupplier, useSupplierMutations } from '@/features/suppliers/hooks'
import type { SupplierInput } from '@/features/suppliers/types'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Dialog,
  InlineNotice,
  LoadingState,
  StatusBadge,
  useToast,
} from '@/shared/ui'

export function SupplierEditorPage() {
  const { id } = useParams()
  const supplierId = id ? Number(id) : null
  const navigate = useNavigate()
  const toast = useToast()
  const tracker = useIntentTracker()
  const mutations = useSupplierMutations()
  const detail = useSupplier(supplierId)
  const supplier = supplierId ? detail.data : undefined
  const [dirty, setDirty] = useState(false)
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

  const backTo = supplierId ? `/suppliers/${supplierId}` : '/suppliers'

  function leave(to: string) {
    leaving.current = true
    setDirty(false)
    void navigate(to)
  }

  async function save(data: Partial<SupplierInput>) {
    if (!supplier) {
      const saved = await tracker.run({ op: 'create', data }, (key) =>
        mutations.create.mutateAsync({ data, key }),
      )
      toast.success(`Proveedor «${saved.name}» creado.`, {
        href: `/suppliers/${saved.id}`,
        linkLabel: 'Ver',
      })
      leave(`/suppliers/${saved.id}`)
      return
    }
    if (Object.keys(data).length === 0) {
      leave(backTo)
      return
    }
    const body = { ...data, expected_version: supplier.version }
    const saved = await tracker.run(
      { op: 'update', id: supplier.id, body },
      (key) =>
        mutations.update.mutateAsync({ id: supplier.id, data: body, key }),
    )
    toast.success(`Proveedor «${saved.name}» actualizado.`)
    leave(`/suppliers/${saved.id}`)
  }

  if (supplierId && detail.isPending) {
    return <LoadingState label="Cargando proveedor…" />
  }
  if (supplierId && (detail.isError || !supplier)) {
    return (
      <InlineNotice title="No se pudo cargar el proveedor" tone="danger">
        Vuelva a la lista e inténtelo de nuevo.
      </InlineNotice>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label={supplier ? 'Volver a la ficha' : 'Volver a proveedores'}
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title={supplier ? 'Volver a la ficha' : 'Volver a proveedores'}
          to={backTo}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Proveedores</p>
          <h1 className="text-[22px] leading-7 font-semibold text-ink">
            {supplier ? `Editar ${supplier.name}` : 'Nuevo proveedor'}
          </h1>
        </div>
        {dirty && <StatusBadge label="Sin guardar" tone="warning" />}
      </div>
      <div className="rounded-panel border border-line bg-surface p-5">
        <SupplierForm
          key={supplier ? `edit-${supplier.id}-${supplier.version}` : 'new'}
          onCancel={() => leave(backTo)}
          onDirtyChange={setDirty}
          onReload={() => void detail.refetch()}
          onSubmit={save}
          supplier={supplier}
        />
      </div>
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

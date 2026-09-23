import { ArrowLeft } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'

import { CustomerForm } from '@/features/customers/CustomerForm'
import { useCustomer, useCustomerMutations } from '@/features/customers/hooks'
import type { CustomerWrite } from '@/features/customers/types'
import {
  Button,
  Dialog,
  InlineNotice,
  LoadingState,
  StatusBadge,
  useToast,
} from '@/shared/ui'

export function CustomerEditorPage() {
  const { id } = useParams()
  const customerId = id ? Number(id) : null
  const navigate = useNavigate()
  const toast = useToast()
  const mutations = useCustomerMutations()
  const detail = useCustomer(customerId ?? 0)
  const customer = customerId ? detail.data : undefined
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

  const backTo = customerId ? `/customers/${customerId}` : '/customers'
  function leave(to: string) {
    leaving.current = true
    setDirty(false)
    void navigate(to)
  }

  async function save(data: CustomerWrite) {
    const saved = customer
      ? await mutations.update.mutateAsync({ id: customer.id, data })
      : await mutations.create.mutateAsync(data)
    toast.success(
      `Cliente «${saved.name}» ${customer ? 'actualizado' : 'registrado'}.`,
      { href: `/customers/${saved.id}`, linkLabel: 'Ver' },
    )
    leave(`/customers/${saved.id}`)
  }

  if (customerId && detail.isPending) {
    return <LoadingState label="Cargando cliente…" />
  }
  if (customerId && (detail.isError || !customer)) {
    return (
      <InlineNotice title="No se pudo cargar el cliente" tone="danger">
        Vuelva a la lista e inténtelo de nuevo.
      </InlineNotice>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label={customer ? 'Volver a la ficha' : 'Volver a clientes'}
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          to={backTo}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Clientes</p>
          <h1 className="text-[22px] leading-7 font-semibold text-ink">
            {customer ? `Editar ${customer.name}` : 'Nuevo cliente'}
          </h1>
        </div>
        {dirty && <StatusBadge label="Sin guardar" tone="warning" />}
      </div>
      <div className="rounded-panel border border-line bg-surface p-5">
        <CustomerForm
          customer={customer}
          key={customer ? `edit-${customer.id}-${customer.version}` : 'new'}
          onCancel={() => leave(backTo)}
          onDirtyChange={setDirty}
          onNavigateToCustomer={(targetId) => leave(`/customers/${targetId}`)}
          onSubmit={save}
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
        <Button onClick={() => blocker.proceed?.()} variant="danger-solid">
          Descartar cambios
        </Button>
      </Dialog>
    </div>
  )
}

import { ArrowLeft, Pencil, Power } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { useSupplier, useSupplierMutations } from '@/features/suppliers/hooks'
import { SupplierDetails } from '@/features/suppliers/SupplierDetails'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  InlineNotice,
  LoadingState,
  PageHeader,
  useToast,
} from '@/shared/ui'

export function SupplierDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const navigate = useNavigate()
  const back = `/suppliers${(location.state as { from?: string } | null)?.from ?? ''}`
  const canManage = new Set(useSession().data?.permissions ?? []).has(
    'proveedores.gestionar',
  )
  const query = useSupplier(Number.isFinite(id) ? id : null)
  const mutations = useSupplierMutations()
  const tracker = useIntentTracker()
  const [change, setChange] = useState<StateChange | null>(null)
  const toast = useToast()
  const supplier = query.data
  const notFound =
    query.error instanceof ProblemError && query.error.status === 404

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
      `Proveedor «${target.name}» ${target.active ? 'reactivado' : 'desactivado'}.`,
    )
  }

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-body font-semibold text-accent"
        to={back}
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Volver a proveedores
      </Link>
      {query.isPending && <LoadingState label="Cargando proveedor…" />}
      {query.isError && (
        <InlineNotice
          title={notFound ? 'Proveedor no encontrado' : 'Error de carga'}
          tone="danger"
        >
          {notFound
            ? 'El proveedor no existe o fue retirado.'
            : 'No fue posible consultar el proveedor. Reintente en unos instantes.'}
        </InlineNotice>
      )}
      {supplier && (
        <>
          <PageHeader
            actions={
              canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      void navigate(`/suppliers/${supplier.id}/edit`)
                    }
                    type="button"
                    variant="secondary"
                  >
                    <Pencil aria-hidden="true" size={15} />
                    Editar
                  </Button>
                  <Button
                    onClick={() =>
                      setChange({
                        id: supplier.id,
                        name: supplier.name,
                        version: supplier.version,
                        active: !supplier.is_active,
                      })
                    }
                    type="button"
                    variant={supplier.is_active ? 'danger' : 'primary'}
                  >
                    <Power aria-hidden="true" size={15} />
                    {supplier.is_active ? 'Desactivar' : 'Reactivar'}
                  </Button>
                </div>
              )
            }
            title={supplier.name}
          />
          <SupplierDetails supplier={supplier} />
          <StateChangeDialog
            activateText="¿Reactivar el proveedor? Volverá a poder seleccionarse en operaciones nuevas."
            change={change}
            deactivateText="¿Desactivar el proveedor? Conserva su identidad y referencias, pero no se podrá seleccionar en operaciones nuevas."
            noun="proveedor"
            onClose={() => setChange(null)}
            onConfirm={changeState}
          />
        </>
      )}
    </div>
  )
}

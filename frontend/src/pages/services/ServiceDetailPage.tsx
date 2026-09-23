import { ArrowLeft, Pencil, Power } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { useService, useServiceMutations } from '@/features/services/hooks'
import { ServiceDetails } from '@/features/services/ServiceDetails'
import { ServiceEditorModal } from '@/features/services/ServiceEditorModal'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  InlineNotice,
  LoadingState,
  PageHeader,
  useToast,
} from '@/shared/ui'

export function ServiceDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const back = `/services${(location.state as { from?: string } | null)?.from ?? ''}`
  const canManage = new Set(useSession().data?.permissions ?? []).has(
    'servicios.gestionar',
  )
  const query = useService(Number.isFinite(id) ? id : null)
  const mutations = useServiceMutations()
  const tracker = useIntentTracker()
  const [editing, setEditing] = useState(false)
  const [change, setChange] = useState<StateChange | null>(null)
  const toast = useToast()
  const service = query.data
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
      `Servicio «${target.name}» ${target.active ? 'reactivado' : 'desactivado'}.`,
    )
  }

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
        to={back}
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Volver a servicios
      </Link>
      {query.isPending && <LoadingState label="Cargando servicio…" />}
      {query.isError && (
        <InlineNotice
          title={notFound ? 'Servicio no encontrado' : 'Error de carga'}
          tone="danger"
        >
          {notFound
            ? 'El servicio no existe o fue retirado.'
            : 'No fue posible consultar el servicio. Reintente en unos instantes.'}
        </InlineNotice>
      )}
      {service && (
        <>
          <PageHeader
            actions={
              canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setEditing(true)}
                    type="button"
                    variant="secondary"
                  >
                    <Pencil aria-hidden="true" size={15} />
                    Editar
                  </Button>
                  <Button
                    onClick={() =>
                      setChange({
                        id: service.id,
                        name: service.name,
                        version: service.version,
                        active: !service.is_active,
                      })
                    }
                    type="button"
                    variant={service.is_active ? 'danger' : 'primary'}
                  >
                    <Power aria-hidden="true" size={15} />
                    {service.is_active ? 'Desactivar' : 'Reactivar'}
                  </Button>
                </div>
              )
            }
            title={service.name}
          />
          <ServiceDetails service={service} />
          <ServiceEditorModal
            mode={editing ? service : null}
            onClose={() => setEditing(false)}
            onSaved={(message) => toast.success(message)}
          />
          <StateChangeDialog
            activateText="¿Reactivar el servicio? Volverá a poder seleccionarse en operaciones nuevas."
            change={change}
            deactivateText="¿Desactivar el servicio? Conserva su identidad y referencias, pero no se podrá seleccionar en operaciones nuevas."
            noun="servicio"
            onClose={() => setChange(null)}
            onConfirm={changeState}
          />
        </>
      )}
    </div>
  )
}

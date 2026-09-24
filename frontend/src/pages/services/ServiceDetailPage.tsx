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
  StatusBadge,
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

  const backLink = (
    <Link
      aria-label="Volver a servicios"
      className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
      title="Volver a servicios"
      to={back}
    >
      <ArrowLeft aria-hidden="true" size={18} />
    </Link>
  )

  if (!service) {
    return (
      <div className="space-y-4">
        {backLink}
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
      </div>
    )
  }

  return (
    <div className="catalog-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {backLink}
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">Servicios</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] leading-7 font-semibold break-words text-ink">
                {service.name}
              </h1>
              <StatusBadge
                label={service.is_active ? 'Activo' : 'Inactivo'}
                tone={service.is_active ? 'success' : 'neutral'}
              />
            </div>
          </div>
        </div>
        {canManage && (
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
        )}
      </div>
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
    </div>
  )
}

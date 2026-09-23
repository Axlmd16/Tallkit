import { ArrowLeft } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import {
  Link,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'

import { VehicleForm } from '@/features/vehicles/VehicleForm'
import { useVehicle, useVehicleMutations } from '@/features/vehicles/hooks'
import type { VehicleCreate, VehicleUpdate } from '@/features/vehicles/types'
import {
  Button,
  Dialog,
  InlineNotice,
  LoadingState,
  StatusBadge,
  useToast,
} from '@/shared/ui'

export function VehicleEditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const vehicleId = id ? Number(id) : null
  const navigate = useNavigate()
  const toast = useToast()
  const mutations = useVehicleMutations()
  const detail = useVehicle(vehicleId)
  const vehicle = vehicleId ? detail.data : undefined
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

  const backTo = vehicleId ? `/vehicles/${vehicleId}` : '/vehicles'
  function leave(to: string) {
    leaving.current = true
    setDirty(false)
    void navigate(to)
  }

  async function save(data: VehicleCreate | (VehicleUpdate & { id: number })) {
    const saved =
      'id' in data
        ? await mutations.updateVehicle.mutateAsync({
            id: data.id,
            data: Object.fromEntries(
              Object.entries(data).filter(([name]) => name !== 'id'),
            ) as unknown as VehicleUpdate,
          })
        : await mutations.createVehicle.mutateAsync(data)
    toast.success(
      `Vehículo «${saved.plate}» ${vehicle ? 'actualizado' : 'registrado'}.`,
      { href: `/vehicles/${saved.id}`, linkLabel: 'Ver' },
    )
    leave(`/vehicles/${saved.id}`)
  }

  if (vehicleId && detail.isPending) {
    return <LoadingState label="Cargando vehículo…" />
  }
  if (vehicleId && (detail.isError || !vehicle)) {
    return (
      <InlineNotice title="No se pudo cargar el vehículo" tone="danger">
        Vuelva a la lista e inténtelo de nuevo.
      </InlineNotice>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label={vehicle ? 'Volver a la ficha' : 'Volver a vehículos'}
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          to={backTo}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Vehículos</p>
          <h1 className="text-[22px] leading-7 font-semibold text-ink">
            {vehicle ? `Editar ${vehicle.plate}` : 'Nuevo vehículo'}
          </h1>
        </div>
        {dirty && <StatusBadge label="Sin guardar" tone="warning" />}
      </div>
      <div className="rounded-panel border border-line bg-surface p-5">
        <VehicleForm
          defaultOwnerId={Number(searchParams.get('owner_id')) || undefined}
          defaultOwnerName={searchParams.get('owner_name') || undefined}
          key={vehicle ? `edit-${vehicle.id}-${vehicle.version}` : 'new'}
          onCancel={() => leave(backTo)}
          onDirtyChange={setDirty}
          onSubmit={save}
          vehicle={vehicle}
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

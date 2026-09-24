import {
  ArrowLeft,
  EnvelopeSimple,
  PencilSimple,
  Phone,
  Power,
} from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { MaintenanceHistorySection } from '@/features/maintenance/MaintenanceHistorySection'
import { useCustomer, useCustomers } from '@/features/customers/hooks'
import { timestamp } from '@/features/purchases/format'
import {
  useVehicle,
  useVehicleMutations,
  useVehicleOwnershipPeriods,
} from '@/features/vehicles/hooks'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  Dialog,
  EmptyState,
  Field,
  InlineNotice,
  LoadingState,
  Pagination,
  PlateTag,
  Select,
  StatusBadge,
  Toolbar,
  useToast,
} from '@/shared/ui'

type Notice = { text: string; tone: 'danger' }

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const vehicleId = Number(id)
  const navigate = useNavigate()

  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const canManage = permissions.has('vehiculos.gestionar')
  const canDeactivate = permissions.has('vehiculos.desactivar')

  const vehicleQuery = useVehicle(vehicleId)
  const vehicle = vehicleQuery.data
  const mutations = useVehicleMutations()
  const toast = useToast()
  // Teléfono y correo del propietario solo para quien puede consultar clientes.
  const owner = useCustomer(
    permissions.has('clientes.ver')
      ? (vehicleQuery.data?.current_owner?.id ?? 0)
      : 0,
  )

  const [notice, setNotice] = useState<Notice | null>(null)
  const [statusConfirmation, setStatusConfirmation] = useState<
    'activate' | 'deactivate' | null
  >(null)

  // Ownership periods state
  const [periodsPage, setPeriodsPage] = useState(1)
  const periodsQuery = useVehicleOwnershipPeriods(vehicleId, periodsPage)
  const periods = periodsQuery.data?.results ?? []

  // Transfer ownership dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState<number | ''>('')
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferConflict, setTransferConflict] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)

  const activeCustomersQuery = useCustomers({ isActive: true })
  const activeCustomers = activeCustomersQuery.data?.results ?? []

  const handleConfirmStateChange = async () => {
    if (!statusConfirmation || !vehicle) return
    const action = statusConfirmation
    setStatusConfirmation(null)
    setNotice(null)
    try {
      if (action === 'deactivate') {
        await mutations.deactivateVehicle.mutateAsync({
          id: vehicle.id,
          expectedVersion: vehicle.version,
        })
        toast.success(`Vehículo con placa «${vehicle.plate}» desactivado.`)
      } else {
        await mutations.activateVehicle.mutateAsync({
          id: vehicle.id,
          expectedVersion: vehicle.version,
        })
        toast.success(`Vehículo con placa «${vehicle.plate}» activado.`)
      }
    } catch (caught) {
      const text =
        caught instanceof ProblemError
          ? caught.status === 409 || caught.code === 'stale_record'
            ? 'La ficha del vehículo fue modificada por otro usuario. Recargue la página para ver la versión más reciente.'
            : caught.message
          : caught instanceof Error
            ? caught.message
            : 'No fue posible cambiar el estado del vehículo.'
      setNotice({ text, tone: 'danger' })
    }
  }

  const handleOpenTransfer = () => {
    setSelectedNewOwnerId(vehicle?.current_owner?.id ?? '')
    setTransferError(null)
    setTransferConflict(false)
    setTransferDialogOpen(true)
  }

  const handleCloseTransfer = () => {
    setTransferDialogOpen(false)
    setSelectedNewOwnerId('')
    setTransferError(null)
    setTransferConflict(false)
  }

  const handleConfirmTransfer = async () => {
    if (!vehicle || !selectedNewOwnerId) return

    setIsTransferring(true)
    setTransferError(null)
    setTransferConflict(false)

    try {
      await mutations.changeOwner.mutateAsync({
        id: vehicle.id,
        data: {
          owner_id: Number(selectedNewOwnerId),
          expected_version: vehicle.version,
        },
        previousOwnerId: vehicle.current_owner?.id,
      })
      toast.success('La propiedad del vehículo fue transferida exitosamente.')
      handleCloseTransfer()
    } catch (err: unknown) {
      if (err instanceof ProblemError) {
        if (err.status === 409 || err.code === 'stale_record') {
          setTransferConflict(true)
          setTransferError(
            'La ficha del vehículo o el propietario fue modificado por otro usuario.',
          )
        } else if (err.code === 'inactive_reference') {
          setTransferError('El cliente seleccionado está inactivo.')
        } else {
          setTransferError(
            err.message || 'Error al transferir la propiedad del vehículo.',
          )
        }
      } else if (err instanceof Error) {
        setTransferError(err.message)
      } else {
        setTransferError('Error inesperado al transferir la propiedad.')
      }
    } finally {
      setIsTransferring(false)
    }
  }

  if (vehicleQuery.isLoading) {
    return <LoadingState label="Cargando ficha del vehículo…" />
  }

  if (vehicleQuery.isError || !vehicle) {
    return (
      <EmptyState
        title="Vehículo no encontrado"
        description="El vehículo solicitado no existe o no se pudo cargar la información."
        action={
          <Button variant="primary" onClick={() => navigate('/vehicles')}>
            Volver a vehículos
          </Button>
        }
      />
    )
  }

  const field = (label: string, value: ReactNode, mono = false) => (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-[13.5px] font-medium text-ink ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </dd>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label="Volver a vehículos"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a vehículos"
          to="/vehicles"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Vehículos</p>
          <h1 className="text-[22px] leading-7 font-semibold text-ink">
            {vehicle.brand.name} {vehicle.model}
          </h1>
        </div>
      </div>

      {notice && (
        <InlineNotice title="No se completó la operación" tone="danger">
          {notice.text}
        </InlineNotice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <section
            aria-label="Resumen del vehículo"
            className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-panel border border-line bg-surface px-5 py-4"
          >
            <PlateTag plate={vehicle.plate} size="lg" />
            <dl className="order-last grid min-w-0 basis-full grid-cols-2 gap-x-6 gap-y-3 sm:order-none sm:flex-1 sm:basis-0 sm:grid-cols-4">
              {field('Marca', vehicle.brand.name)}
              {field('Año', vehicle.year ?? 'No especificado')}
              {field('Color', vehicle.color || 'No especificado')}
              {field(
                'Número de chasis (VIN)',
                vehicle.vin || 'No especificado',
                Boolean(vehicle.vin),
              )}
            </dl>
            <div className="ml-auto sm:ml-0">
              <StatusBadge
                label={vehicle.is_active ? 'Activo' : 'Inactivo'}
                tone={vehicle.is_active ? 'success' : 'neutral'}
              />
            </div>
          </section>

          <section
            aria-labelledby="vehicle-periods-title"
            className="overflow-hidden rounded-panel border border-line bg-surface"
          >
            <div className="border-b border-line px-5 py-3">
              <h2
                className="text-[14.5px] font-semibold text-ink"
                id="vehicle-periods-title"
              >
                Historial de propiedad
              </h2>
            </div>
            {periodsQuery.isLoading ? (
              <LoadingState label="Cargando períodos de propiedad…" />
            ) : periods.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-ink-muted">
                No hay períodos de propiedad registrados para este vehículo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-subtle text-[11.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
                      <th className="h-9 px-4">Propietario</th>
                      <th className="h-9 px-4">Identificación</th>
                      <th className="h-9 px-4">Inicio</th>
                      <th className="h-9 px-4">Fin</th>
                      <th className="h-9 px-4 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {periods.map((p) => (
                      <tr className="hover:bg-surface-subtle" key={p.id}>
                        <td className="h-12 px-4 font-medium">
                          <Link
                            className="text-accent hover:underline"
                            to={`/customers/${p.customer.id}`}
                          >
                            {p.customer.name}
                          </Link>
                        </td>
                        <td className="h-12 px-4 font-mono text-xs text-ink-muted">
                          {p.customer.identification}
                        </td>
                        <td className="h-12 px-4 text-ink-muted">
                          {timestamp(p.started_at)}
                        </td>
                        <td className="h-12 px-4 text-ink-muted">
                          {p.ended_at ? timestamp(p.ended_at) : 'Vigente'}
                        </td>
                        <td className="h-12 px-4 text-right">
                          <StatusBadge
                            label={p.is_current ? 'Vigente' : 'Finalizado'}
                            tone={p.is_current ? 'success' : 'neutral'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {periodsQuery.data && periodsQuery.data.total_pages > 1 && (
                  <div className="px-4 pb-3">
                    <Pagination
                      onNext={() =>
                        setPeriodsPage((prev) =>
                          Math.min(prev + 1, periodsQuery.data.total_pages),
                        )
                      }
                      onPrevious={() =>
                        setPeriodsPage((prev) => Math.max(prev - 1, 1))
                      }
                      page={periodsPage}
                      totalPages={periodsQuery.data.total_pages}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
          {permissions.has('mantenimientos.ver') && (
            <MaintenanceHistorySection
              canCreate={
                vehicle.is_active &&
                Boolean(vehicle.current_owner) &&
                permissions.has('mantenimientos.gestionar')
              }
              customer={
                vehicle.current_owner
                  ? {
                      id: vehicle.current_owner.id,
                      name: vehicle.current_owner.name,
                    }
                  : undefined
              }
              vehicleId={vehicle.id}
            />
          )}
        </div>

        <aside className="space-y-4">
          {(canManage || canDeactivate) && (
            <section
              aria-labelledby="vehicle-actions-title"
              className="rounded-panel border border-line bg-surface"
            >
              <div className="border-b border-line px-4 py-3">
                <h2
                  className="text-[14.5px] font-semibold text-ink"
                  id="vehicle-actions-title"
                >
                  Acciones
                </h2>
              </div>
              <div className="flex flex-col gap-2 p-4">
                {canManage && (
                  <Button
                    onClick={() =>
                      void navigate(`/vehicles/${vehicle.id}/edit`)
                    }
                  >
                    <PencilSimple aria-hidden="true" size={16} />
                    Editar vehículo
                  </Button>
                )}
                {canManage && vehicle.is_active && (
                  <Button onClick={handleOpenTransfer} variant="secondary">
                    Cambiar propietario
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    onClick={() =>
                      setStatusConfirmation(
                        vehicle.is_active ? 'deactivate' : 'activate',
                      )
                    }
                    variant={vehicle.is_active ? 'danger' : 'secondary'}
                  >
                    <Power aria-hidden="true" size={16} />
                    {vehicle.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                )}
              </div>
            </section>
          )}

          <section
            aria-labelledby="vehicle-owner-title"
            className="rounded-panel border border-line bg-surface"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2
                className="text-[14.5px] font-semibold text-ink"
                id="vehicle-owner-title"
              >
                Propietario actual
              </h2>
              {vehicle.current_owner && (
                <Link
                  className="text-[12.5px] font-semibold text-accent hover:underline"
                  to={`/customers/${vehicle.current_owner.id}`}
                >
                  Ver cliente
                </Link>
              )}
            </div>
            {vehicle.current_owner ? (
              <div className="space-y-3 p-4 text-[13px]">
                <div>
                  <Link
                    className="text-sm font-semibold text-ink hover:text-accent hover:underline"
                    to={`/customers/${vehicle.current_owner.id}`}
                  >
                    {vehicle.current_owner.name}
                  </Link>
                  <p className="text-[12.5px] text-ink-muted">
                    Identificación{' '}
                    <span className="font-mono">
                      {vehicle.current_owner.identification}
                    </span>
                  </p>
                </div>
                {owner.data?.phone && (
                  <p className="flex items-center gap-2">
                    <Phone
                      aria-hidden="true"
                      className="text-ink-muted"
                      size={16}
                    />
                    {owner.data.phone}
                  </p>
                )}
                {owner.data?.email && (
                  <p className="flex min-w-0 items-center gap-2">
                    <EnvelopeSimple
                      aria-hidden="true"
                      className="shrink-0 text-ink-muted"
                      size={16}
                    />
                    <span className="truncate">{owner.data.email}</span>
                  </p>
                )}
                {!vehicle.current_owner.is_active && (
                  <StatusBadge label="Cliente inactivo" tone="neutral" />
                )}
              </div>
            ) : (
              <p className="p-4 text-[13px] text-ink-muted">
                Este vehículo no tiene propietario registrado actualmente.
              </p>
            )}
          </section>
        </aside>
      </div>

      {/* Modal / Dialog de cambio de propietario */}
      <Dialog
        open={transferDialogOpen}
        onClose={handleCloseTransfer}
        title="Cambiar propietario"
        description={`Seleccione el nuevo cliente que será propietario del vehículo con placa ${vehicle.plate}.`}
      >
        <div className="space-y-4 pt-2">
          {transferError && (
            <InlineNotice
              tone="danger"
              title={
                transferConflict
                  ? 'Conflicto de concurrencia'
                  : 'Error de transferencia'
              }
            >
              <div className="space-y-2">
                <p>{transferError}</p>
                {transferConflict && (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await vehicleQuery.refetch()
                      setTransferConflict(false)
                      setTransferError(null)
                    }}
                  >
                    Actualizar datos del vehículo
                  </Button>
                )}
              </div>
            </InlineNotice>
          )}

          <div className="rounded-control bg-surface-muted p-3 text-xs text-ink">
            <p>
              <span className="font-semibold">Vehículo:</span> {vehicle.plate} (
              {vehicle.brand.name} {vehicle.model})
            </p>
            <p className="mt-1">
              <span className="font-semibold">Propietario actual:</span>{' '}
              {vehicle.current_owner
                ? `${vehicle.current_owner.name} (${vehicle.current_owner.identification})`
                : 'Sin propietario'}
            </p>
          </div>

          <Field
            label="Nuevo cliente propietario"
            hint="Seleccione de la lista de clientes activos registrados en el sistema."
            error={
              transferError && !transferConflict ? transferError : undefined
            }
          >
            <Select
              value={selectedNewOwnerId}
              onChange={(e) => {
                setSelectedNewOwnerId(
                  e.target.value ? Number(e.target.value) : '',
                )
                setTransferError(null)
                setTransferConflict(false)
              }}
              disabled={isTransferring}
            >
              <option value="">Seleccione un cliente…</option>
              {activeCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.identification})
                </option>
              ))}
            </Select>
          </Field>

          {selectedNewOwnerId &&
            Number(selectedNewOwnerId) === vehicle.current_owner?.id && (
              <InlineNotice tone="info" title="Mismo propietario">
                El cliente seleccionado ya es el propietario actual. Al
                confirmar, se conservará el período vigente sin modificaciones.
              </InlineNotice>
            )}

          <div className="flex justify-end gap-3 border-t border-ink/10 pt-4">
            <Button
              type="button"
              variant="quiet"
              onClick={handleCloseTransfer}
              disabled={isTransferring}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmTransfer}
              pending={isTransferring}
              pendingLabel="Transfiriendo…"
              disabled={!selectedNewOwnerId || isTransferring}
            >
              Confirmar transferencia
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Diálogo para confirmación de cambio de estado */}
      <Dialog
        open={statusConfirmation !== null}
        onClose={() => setStatusConfirmation(null)}
        title={
          statusConfirmation === 'deactivate'
            ? 'Desactivar vehículo'
            : 'Activar vehículo'
        }
        description={
          statusConfirmation === 'deactivate'
            ? `Al desactivar el vehículo «${vehicle.plate}», conservará su historial de propietarios pero no podrá ser utilizado en nuevas operaciones activas.`
            : `Al reactivar el vehículo «${vehicle.plate}», volverá a estar disponible para operaciones activas.`
        }
      >
        <Toolbar label="Confirmación de estado de vehículo">
          <Button
            variant={statusConfirmation === 'deactivate' ? 'danger' : 'primary'}
            onClick={() => void handleConfirmStateChange()}
          >
            {statusConfirmation === 'deactivate'
              ? 'Confirmar desactivación'
              : 'Confirmar activación'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setStatusConfirmation(null)}
          >
            Cancelar
          </Button>
        </Toolbar>
      </Dialog>
    </div>
  )
}

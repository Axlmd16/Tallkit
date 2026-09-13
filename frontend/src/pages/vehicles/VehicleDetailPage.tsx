import {
  ArrowLeft,
  Car,
  Clock,
  PencilSimple,
  Power,
  User,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useCustomers } from '@/features/customers/hooks'
import {
  useVehicle,
  useVehicleMutations,
  useVehicleOwnershipPeriods,
} from '@/features/vehicles/hooks'
import type { VehicleCreate, VehicleUpdate } from '@/features/vehicles/types'
import { VehicleForm } from '@/features/vehicles/VehicleForm'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  InlineNotice,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Surface,
  Toolbar,
} from '@/shared/ui'

type Notice = { text: string; tone: 'success' | 'danger' }

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

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
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

  const handleSave = async (
    data: VehicleCreate | (VehicleUpdate & { id: number }),
  ) => {
    if (!('id' in data)) return
    const { id: targetId, ...updateData } = data
    await mutations.updateVehicle.mutateAsync({
      id: targetId,
      data: updateData,
    })
    setNotice({
      text: 'Datos del vehículo actualizados correctamente.',
      tone: 'success',
    })
    setDrawerOpen(false)
    setFormDirty(false)
  }

  const handleCloseDrawer = () => {
    if (formDirty) {
      const confirmed = window.confirm(
        'Tiene cambios sin guardar. ¿Desea descartarlos?',
      )
      if (!confirmed) return
    }
    setDrawerOpen(false)
    setFormDirty(false)
  }

  const handleCancel = () => {
    setDrawerOpen(false)
    setFormDirty(false)
  }

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
        setNotice({
          text: `Vehículo con placa «${vehicle.plate}» desactivado.`,
          tone: 'success',
        })
      } else {
        await mutations.activateVehicle.mutateAsync({
          id: vehicle.id,
          expectedVersion: vehicle.version,
        })
        setNotice({
          text: `Vehículo con placa «${vehicle.plate}» activado.`,
          tone: 'success',
        })
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
      setNotice({
        text: 'La propiedad del vehículo fue transferida exitosamente.',
        tone: 'success',
      })
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/vehicles"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          <span>Volver al listado</span>
        </Link>
      </div>

      <PageHeader
        title={vehicle.plate}
        description={`${vehicle.brand.name} ${vehicle.model}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge
              label={vehicle.is_active ? 'Activo' : 'Inactivo'}
              tone={vehicle.is_active ? 'success' : 'neutral'}
            />
            {canManage && (
              <Button
                variant="primary"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2"
              >
                <PencilSimple size={18} />
                <span>Editar vehículo</span>
              </Button>
            )}
            {canDeactivate && (
              <Button
                variant={vehicle.is_active ? 'danger' : 'secondary'}
                onClick={() =>
                  setStatusConfirmation(
                    vehicle.is_active ? 'deactivate' : 'activate',
                  )
                }
                className="inline-flex items-center gap-2"
              >
                <Power size={18} />
                <span>{vehicle.is_active ? 'Desactivar' : 'Activar'}</span>
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <InlineNotice
          tone={notice.tone}
          title={notice.tone === 'success' ? 'Éxito' : 'Error'}
        >
          {notice.text}
        </InlineNotice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Ficha técnica del vehículo */}
        <Surface className="space-y-6 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
            <Car size={22} className="text-primary" />
            <h2 className="text-lg font-semibold text-ink">
              Información técnica del vehículo
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Placa
              </p>
              <p className="mt-1 font-mono text-base font-bold text-ink">
                {vehicle.plate}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Marca
              </p>
              <p className="mt-1 text-base font-medium text-ink">
                {vehicle.brand.name}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Modelo
              </p>
              <p className="mt-1 text-base font-medium text-ink">
                {vehicle.model}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Color
              </p>
              <p className="mt-1 text-base font-medium text-ink">
                {vehicle.color || 'No especificado'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Año de fabricación
              </p>
              <p className="mt-1 text-base font-medium text-ink">
                {vehicle.year ?? 'No especificado'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Número de chasis (VIN)
              </p>
              <p className="mt-1 font-mono text-base font-medium text-ink">
                {vehicle.vin || 'No especificado'}
              </p>
            </div>
          </div>
        </Surface>

        {/* Propietario actual */}
        <Surface className="space-y-6 p-6">
          <div className="flex items-center justify-between border-b border-ink/10 pb-3">
            <div className="flex items-center gap-2">
              <User size={22} className="text-primary" />
              <h2 className="text-lg font-semibold text-ink">
                Propietario actual
              </h2>
            </div>
            {canManage && vehicle.is_active && (
              <Button variant="secondary" onClick={handleOpenTransfer}>
                Cambiar propietario
              </Button>
            )}
          </div>

          {vehicle.current_owner ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Nombre del cliente
                </p>
                <Link
                  to={`/customers/${vehicle.current_owner.id}`}
                  className="mt-1 block text-base font-semibold text-primary hover:underline"
                >
                  {vehicle.current_owner.name}
                </Link>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Identificación
                </p>
                <p className="mt-1 font-mono text-sm font-medium text-ink">
                  {vehicle.current_owner.identification}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Estado del propietario
                </p>
                <div className="mt-1">
                  <StatusBadge
                    label={
                      vehicle.current_owner.is_active ? 'Activo' : 'Inactivo'
                    }
                    tone={
                      vehicle.current_owner.is_active ? 'success' : 'neutral'
                    }
                  />
                </div>
              </div>

              <div className="rounded-control bg-surface-muted p-3 text-xs text-ink-muted">
                Para transferir la titularidad de este vehículo a otro cliente,
                utilice el botón de cambio de propietario.
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Este vehículo no tiene propietario registrado actualmente.
            </p>
          )}
        </Surface>
      </div>

      {/* Historial de períodos de propiedad */}
      <Surface className="space-y-4 p-6">
        <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
          <Clock size={22} className="text-primary" />
          <h2 className="text-lg font-semibold text-ink">
            Historial de períodos de propiedad
          </h2>
        </div>

        {periodsQuery.isLoading ? (
          <LoadingState label="Cargando períodos de propiedad…" />
        ) : periods.length === 0 ? (
          <EmptyState
            title="Sin períodos de propiedad"
            description="No hay períodos de propiedad registrados para este vehículo."
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    <th className="pb-3 pr-4">Propietario</th>
                    <th className="pb-3 pr-4">Identificación</th>
                    <th className="pb-3 pr-4">Inicio</th>
                    <th className="pb-3 pr-4">Fin</th>
                    <th className="pb-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {periods.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-muted/50">
                      <td className="py-3 pr-4 font-medium text-ink">
                        <Link
                          to={`/customers/${p.customer.id}`}
                          className="text-primary hover:underline"
                        >
                          {p.customer.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                        {p.customer.identification}
                      </td>
                      <td className="py-3 pr-4 text-ink-muted">
                        {new Date(p.started_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-ink-muted">
                        {p.ended_at
                          ? new Date(p.ended_at).toLocaleString()
                          : 'Vigente'}
                      </td>
                      <td className="py-3 text-right">
                        <StatusBadge
                          label={p.is_current ? 'Vigente' : 'Finalizado'}
                          tone={p.is_current ? 'success' : 'neutral'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {periodsQuery.data && periodsQuery.data.total_pages > 1 && (
              <Pagination
                page={periodsPage}
                totalPages={periodsQuery.data.total_pages}
                onNext={() =>
                  setPeriodsPage((prev) =>
                    Math.min(prev + 1, periodsQuery.data.total_pages),
                  )
                }
                onPrevious={() =>
                  setPeriodsPage((prev) => Math.max(prev - 1, 1))
                }
              />
            )}
          </div>
        )}
      </Surface>

      {/* Drawer de edición */}
      <Drawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        title="Editar vehículo"
        description={`Modifique los datos técnicos del vehículo con placa ${vehicle.plate}.`}
      >
        <VehicleForm
          vehicle={vehicle}
          onSubmit={handleSave}
          onCancel={handleCancel}
          onDirtyChange={setFormDirty}
        />
      </Drawer>

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

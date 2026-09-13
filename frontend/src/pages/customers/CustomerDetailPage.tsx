import {
  ArrowLeft,
  Car,
  PencilSimple,
  Plus,
  Power,
  User,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { useCustomer, useCustomerMutations } from '@/features/customers/hooks'
import type { CustomerWrite } from '@/features/customers/types'
import {
  useCustomerVehicles,
  useVehicleMutations,
} from '@/features/vehicles/hooks'
import type { VehicleCreate, VehicleUpdate } from '@/features/vehicles/types'
import { VehicleForm } from '@/features/vehicles/VehicleForm'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  Dialog,
  Drawer,
  EmptyState,
  InlineNotice,
  LoadingState,
  PageHeader,
  StatusBadge,
  Surface,
  Toolbar,
} from '@/shared/ui'

type Confirmation = 'activate' | 'deactivate'
type Notice = { text: string; tone: 'success' | 'danger' }

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const navigate = useNavigate()
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const canManage = permissions.has('clientes.gestionar')
  const canDeactivate = permissions.has('clientes.desactivar')
  const canManageVehicles = permissions.has('vehiculos.gestionar')

  const customerQuery = useCustomer(customerId)
  const customer = customerQuery.data
  const mutations = useCustomerMutations()

  const vehiclesQuery = useCustomerVehicles(customerId)
  const vehicleMutations = useVehicleMutations()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [vehicleDrawerOpen, setVehicleDrawerOpen] = useState(false)
  const [vehicleFormDirty, setVehicleFormDirty] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  async function saveCustomer(data: CustomerWrite) {
    if (!customer) return
    await mutations.update.mutateAsync({ id: customer.id, data })
    setNotice({ text: 'Cliente actualizado correctamente.', tone: 'success' })
    setDrawerOpen(false)
    setFormDirty(false)
  }

  async function saveVehicle(
    data: VehicleCreate | (VehicleUpdate & { id: number }),
  ) {
    await vehicleMutations.createVehicle.mutateAsync(data as VehicleCreate)
    setNotice({
      text: 'Vehículo registrado correctamente.',
      tone: 'success',
    })
    setVehicleDrawerOpen(false)
    setVehicleFormDirty(false)
  }

  async function runConfirmation() {
    if (!confirmation || !customer) return
    const action = confirmation
    setConfirmation(null)
    setNotice(null)
    try {
      if (action === 'deactivate') {
        await mutations.deactivate.mutateAsync({
          id: customer.id,
          expectedVersion: customer.version,
        })
        setNotice({
          text: `Cliente «${customer.name}» desactivado.`,
          tone: 'success',
        })
      } else {
        await mutations.activate.mutateAsync({
          id: customer.id,
          expectedVersion: customer.version,
        })
        setNotice({
          text: `Cliente «${customer.name}» activado.`,
          tone: 'success',
        })
      }
    } catch (caught) {
      const text =
        caught instanceof ProblemError
          ? caught.status === 409 || caught.code === 'stale_record'
            ? 'La ficha del cliente fue modificada por otro usuario. Recargue la página para ver la versión más reciente.'
            : caught.message
          : caught instanceof Error
            ? caught.message
            : 'No fue posible cambiar el estado del cliente.'
      setNotice({ text, tone: 'danger' })
    }
  }

  if (customerQuery.isPending) {
    return <LoadingState label="Cargando ficha del cliente…" />
  }

  if (customerQuery.isError || !customer) {
    return (
      <div className="customer-detail-page space-y-6">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          to="/customers"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Volver a clientes
        </Link>
        <EmptyState
          action={
            <Link
              className="ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-group border px-4 py-2 text-sm font-semibold border-primary bg-primary text-white"
              to="/customers"
            >
              Volver al listado
            </Link>
          }
          description="El cliente solicitado no existe o no fue posible cargar su información."
          title="No fue posible cargar la ficha del cliente"
        />
      </div>
    )
  }

  return (
    <div className="customer-detail-page space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          to="/customers"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Volver a clientes
        </Link>
      </div>

      <PageHeader
        actions={
          <Toolbar label="Acciones de la ficha">
            {canManage && (
              <Button onClick={() => setDrawerOpen(true)}>
                <PencilSimple aria-hidden="true" size={18} />
                Editar cliente
              </Button>
            )}
            {canDeactivate && (
              <Button
                onClick={() =>
                  setConfirmation(
                    customer.is_active ? 'deactivate' : 'activate',
                  )
                }
                variant={customer.is_active ? 'danger' : 'secondary'}
              >
                <Power aria-hidden="true" size={18} />
                {customer.is_active ? 'Desactivar' : 'Activar'}
              </Button>
            )}
          </Toolbar>
        }
        description={`Ficha compartida · ${customer.person_type === 'JURIDICA' ? 'Persona jurídica' : 'Persona natural'}`}
        title={customer.name}
      />

      {notice && <InlineNotice title={notice.text} tone={notice.tone} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Surface className="space-y-4 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-surface-muted pb-4">
            <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
              <User aria-hidden="true" size={26} weight="fill" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">
                Datos de identificación y contacto
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge
                  label={customer.is_active ? 'Activo' : 'Inactivo'}
                  tone={customer.is_active ? 'success' : 'neutral'}
                />
                <span className="text-xs text-ink-muted">
                  Versión: {customer.version}
                </span>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-ink-muted uppercase">
                Tipo de persona
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {customer.person_type === 'JURIDICA'
                  ? 'Persona jurídica'
                  : 'Persona natural'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-ink-muted uppercase">
                {customer.identification_type}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {customer.identification}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-ink-muted uppercase">
                Teléfono de contacto
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {customer.phone}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-ink-muted uppercase">
                Correo electrónico
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {customer.email || (
                  <span className="text-ink-muted">No registrado</span>
                )}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-ink-muted uppercase">
                Dirección
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {customer.address || (
                  <span className="text-ink-muted">No registrada</span>
                )}
              </dd>
            </div>
          </dl>
        </Surface>

        <Surface className="space-y-4">
          <div className="flex items-center justify-between border-b border-surface-muted pb-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
                <Car aria-hidden="true" size={26} weight="fill" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">
                  Vehículos asociados
                </h2>
                <p className="text-xs text-ink-muted">Propiedad actual</p>
              </div>
            </div>
            {canManageVehicles && (
              <Button
                variant="secondary"
                onClick={() => setVehicleDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs"
              >
                <Plus aria-hidden="true" size={16} />
                <span>Registrar vehículo</span>
              </Button>
            )}
          </div>

          {vehiclesQuery.isPending ? (
            <p className="text-sm text-ink-muted">Cargando vehículos…</p>
          ) : vehiclesQuery.isError ? (
            <p className="text-sm text-danger">
              No fue posible cargar los vehículos asociados.
            </p>
          ) : (vehiclesQuery.data?.results.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-muted">
              El cliente no tiene vehículos asociados actualmente.
            </p>
          ) : (
            <div className="divide-y divide-surface-muted">
              {vehiclesQuery.data?.results.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <Link
                      to={`/vehicles/${v.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {v.plate}
                    </Link>
                    <p className="text-sm text-ink">
                      {v.brand.name} {v.model}
                    </p>
                    {(v.color || v.year) && (
                      <p className="text-xs text-ink-muted">
                        {[v.color, v.year].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={v.is_active ? 'Activo' : 'Inactivo'}
                      tone={v.is_active ? 'success' : 'neutral'}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>

      <Drawer
        description="Actualice los datos de contacto o identificación del cliente."
        onClose={() => {
          if (
            !formDirty ||
            window.confirm('Hay cambios sin guardar. ¿Desea descartarlos?')
          ) {
            setDrawerOpen(false)
            setFormDirty(false)
          }
        }}
        open={drawerOpen}
        title={`Editar cliente: ${customer.name}`}
      >
        <CustomerForm
          customer={customer}
          onCancel={() => {
            setDrawerOpen(false)
            setFormDirty(false)
          }}
          onDirtyChange={setFormDirty}
          onNavigateToCustomer={(targetId) => {
            setDrawerOpen(false)
            navigate(`/customers/${targetId}`)
          }}
          onSubmit={saveCustomer}
        />
      </Drawer>

      <Drawer
        description={`Registre un vehículo asignado a ${customer.name}.`}
        onClose={() => {
          if (
            !vehicleFormDirty ||
            window.confirm('Hay cambios sin guardar. ¿Desea descartarlos?')
          ) {
            setVehicleDrawerOpen(false)
            setVehicleFormDirty(false)
          }
        }}
        open={vehicleDrawerOpen}
        title="Registrar vehículo"
      >
        <VehicleForm
          defaultOwnerId={customer.id}
          defaultOwnerName={customer.name}
          onCancel={() => {
            setVehicleDrawerOpen(false)
            setVehicleFormDirty(false)
          }}
          onDirtyChange={setVehicleFormDirty}
          onSubmit={saveVehicle}
        />
      </Drawer>

      <Dialog
        description={
          confirmation === 'deactivate'
            ? `Al desactivar a «${customer.name}», no podrá ser seleccionado como propietario en nuevas operaciones. Su historial y vehículos vigentes se conservarán.`
            : `Al reactivar a «${customer.name}», volverá a estar disponible para nuevas asociaciones con su misma información.`
        }
        onClose={() => setConfirmation(null)}
        open={confirmation !== null}
        title={
          confirmation === 'deactivate'
            ? 'Desactivar cliente'
            : 'Activar cliente'
        }
      >
        <Toolbar label="Confirmación de estado">
          <Button
            onClick={() => void runConfirmation()}
            variant={confirmation === 'deactivate' ? 'danger' : 'primary'}
          >
            {confirmation === 'deactivate'
              ? 'Confirmar desactivación'
              : 'Confirmar activación'}
          </Button>
          <Button onClick={() => setConfirmation(null)} variant="secondary">
            Cancelar
          </Button>
        </Toolbar>
      </Dialog>
    </div>
  )
}

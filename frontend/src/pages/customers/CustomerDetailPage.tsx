import { ArrowLeft, PencilSimple, Plus, Power } from '@phosphor-icons/react'
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
  ConfirmationPanel,
  DetailCard,
  Drawer,
  EmptyState,
  InlineNotice,
  LoadingState,
  PageHeader,
  StatusBadge,
  Toolbar,
} from '@/shared/ui'

type Confirmation = 'activate' | 'deactivate'
type Notice = { text: string; tone: 'success' | 'danger' }

// Clases del catálogo para <Link> que actúa visualmente como Button variant="primary"
const primaryButtonLinkClass =
  'ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-group border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-primary-strong hover:bg-primary-strong active:translate-y-px'

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
            <Link className={primaryButtonLinkClass} to="/customers">
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
        <DetailCard
          badge={
            <StatusBadge
              label={customer.is_active ? 'Activo' : 'Inactivo'}
              tone={customer.is_active ? 'success' : 'neutral'}
            />
          }
          className="lg:col-span-2"
          metadata={[
            {
              label: 'Tipo de persona',
              value:
                customer.person_type === 'JURIDICA'
                  ? 'Persona jurídica'
                  : 'Persona natural',
            },
            {
              label: customer.identification_type,
              value: customer.identification,
            },
            { label: 'Teléfono de contacto', value: customer.phone },
            {
              label: 'Correo electrónico',
              value: customer.email || (
                <span className="text-ink-muted">No registrado</span>
              ),
            },
            {
              label: 'Dirección',
              value: customer.address || (
                <span className="text-ink-muted">No registrada</span>
              ),
            },
            { label: 'Versión de registro', value: String(customer.version) },
          ]}
          title="Datos de identificación y contacto"
        />

        <DetailCard
          actions={
            canManageVehicles ? (
              <Button
                className="text-xs"
                onClick={() => setVehicleDrawerOpen(true)}
                variant="secondary"
              >
                <Plus aria-hidden="true" size={16} />
                Registrar vehículo
              </Button>
            ) : undefined
          }
          subtitle="Propiedad actual"
          title="Vehículos asociados"
        >
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
        </DetailCard>
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

      <ConfirmationPanel
        cancelLabel="Cancelar"
        confirmLabel={
          confirmation === 'deactivate'
            ? 'Confirmar desactivación'
            : 'Confirmar activación'
        }
        description={
          confirmation === 'deactivate'
            ? `Al desactivar a «${customer.name}», no podrá ser seleccionado como propietario en nuevas operaciones. Su historial y vehículos vigentes se conservarán.`
            : `Al reactivar a «${customer.name}», volverá a estar disponible para nuevas asociaciones con su misma información.`
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void runConfirmation()}
        open={confirmation !== null}
        title={
          confirmation === 'deactivate'
            ? 'Desactivar cliente'
            : 'Activar cliente'
        }
        tone={confirmation === 'deactivate' ? 'danger' : 'primary'}
      />
    </div>
  )
}

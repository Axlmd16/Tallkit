import { ArrowLeft, PencilSimple, Plus, Power } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  CustomerDebt,
  CustomerPurchases,
  customerAccountAccess,
} from '@/features/customers/CustomerAccounts'
import { useCustomerAccountSummary } from '@/features/customers/accounts'
import { BusinessAmounts, owed } from '@/features/customers/BusinessAmounts'
import { useCustomer, useCustomerMutations } from '@/features/customers/hooks'
import { documentDate } from '@/features/maintenance/format'
import { NewMaintenanceDialog } from '@/features/maintenance/NewMaintenanceDialog'
import { useCustomerVehicles } from '@/features/vehicles/hooks'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  ConfirmationPanel,
  DetailCard,
  EmptyState,
  InlineNotice,
  LoadingState,
  PageHeader,
  StatTile,
  StatTiles,
  StatusBadge,
  Tabs,
  Toolbar,
  VehicleTile,
  useToast,
} from '@/shared/ui'

type Confirmation = 'activate' | 'deactivate'

// Clases del catálogo para <Link> que actúa visualmente como Button variant="primary"
const primaryButtonLinkClass =
  'ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-primary bg-primary px-4 py-2 text-body font-semibold text-white transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-primary-strong hover:bg-primary-strong active:translate-y-px'

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
  const accounts = useCustomerAccountSummary(customerId).data
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)

  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const toast = useToast()

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
        toast.success(`Cliente «${customer.name}» desactivado.`)
      } else {
        await mutations.activate.mutateAsync({
          id: customer.id,
          expectedVersion: customer.version,
        })
        toast.success(`Cliente «${customer.name}» activado.`)
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
      setNotice(text)
    }
  }

  if (customerQuery.isPending) {
    return <LoadingState label="Cargando ficha del cliente…" />
  }

  if (customerQuery.isError || !customer) {
    return (
      <div className="customer-detail-page space-y-6">
        <Link
          className="inline-flex items-center gap-2 text-body font-semibold text-accent hover:underline"
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

  const access = customerAccountAccess(permissions)
  const requestedTab = params.get('tab')
  const available = [
    'vehiculos',
    ...(access.commercialPurchases || access.artisanPurchases
      ? ['compras']
      : []),
    ...(access.commercialDebt || access.artisanDebt ? ['deuda'] : []),
    'datos',
  ]
  const activeTab =
    requestedTab && available.includes(requestedTab)
      ? requestedTab
      : 'vehiculos'
  const debtArtisan = owed(accounts?.artisan?.balance)
  const debtCommercial = owed(accounts?.commercial?.balance)
  const canSeeSpent =
    accounts?.artisan?.spent_year != null ||
    accounts?.commercial?.spent_year != null
  const canSeeDebt =
    accounts?.artisan?.balance != null || accounts?.commercial?.balance != null
  const lastVisit = accounts?.visits?.last_on
  const canSell = permissions.has('ventas.crear') && customer.is_active
  const since = new Date(customer.created_at).toLocaleDateString('es-EC', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="customer-detail-page space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-2 text-body font-semibold text-accent hover:underline"
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
              <Button
                onClick={() => void navigate(`/customers/${customer.id}/edit`)}
                variant="quiet"
              >
                <PencilSimple aria-hidden="true" size={18} />
                Editar cliente
              </Button>
            )}
            {canSell && (
              <Button
                onClick={() =>
                  void navigate(
                    `/sales/quick?customer=${encodeURIComponent(customer.identification)}`,
                  )
                }
                variant="secondary"
              >
                Venta rápida
              </Button>
            )}
            {permissions.has('mantenimientos.gestionar') &&
              customer.is_active && (
                <Button onClick={() => setMaintenanceOpen(true)}>
                  <Plus aria-hidden="true" size={18} />
                  Nuevo mantenimiento
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
        description={[customer.identification, customer.phone, customer.email]
          .filter(Boolean)
          .join(' · ')}
        eyebrow={`Cliente desde ${since}`}
        title={customer.name}
      />

      <StatTiles label="Resumen del cliente">
        {accounts?.visits && (
          <StatTile
            label="Visitas este año"
            value={accounts.visits.count_year}
          />
        )}
        {canSeeSpent && (
          <StatTile
            label="Gastado este año"
            value={
              <BusinessAmounts
                artisan={accounts?.artisan?.spent_year}
                commercial={accounts?.commercial?.spent_year}
              />
            }
          />
        )}
        {accounts?.visits && (
          <StatTile
            label="Última visita"
            value={lastVisit ? documentDate(lastVisit) : 'Nunca'}
          />
        )}
        {canSeeDebt && (
          <StatTile
            label="Debe"
            tone={debtArtisan || debtCommercial ? 'danger' : 'neutral'}
            value={
              <BusinessAmounts
                artisan={debtArtisan}
                commercial={debtCommercial}
                empty="Nada"
              />
            }
          />
        )}
      </StatTiles>

      {notice && (
        <InlineNotice title="No se completó la operación" tone="danger">
          {notice}
        </InlineNotice>
      )}

      <Tabs
        activeId={activeTab}
        aria-label="Secciones de la ficha del cliente"
        items={[
          {
            id: 'vehiculos',
            label: 'Vehículos',
            ...(vehiclesQuery.data
              ? { count: vehiclesQuery.data.results.length }
              : {}),
            content: (
              <DetailCard
                actions={
                  canManageVehicles ? (
                    <Button
                      className="text-label"
                      onClick={() =>
                        void navigate(
                          `/vehicles/new?owner_id=${customer.id}&owner_name=${encodeURIComponent(customer.name)}`,
                        )
                      }
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
                  <p className="text-body text-ink-muted">
                    Cargando vehículos…
                  </p>
                ) : vehiclesQuery.isError ? (
                  <p className="text-body text-danger">
                    No fue posible cargar los vehículos asociados.
                  </p>
                ) : (vehiclesQuery.data?.results.length ?? 0) === 0 ? (
                  <p className="text-body text-ink-muted">
                    El cliente no tiene vehículos asociados actualmente.
                  </p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3.5">
                    {vehiclesQuery.data?.results.map((v) => (
                      <VehicleTile
                        footer={
                          [v.color, v.year].filter(Boolean).join(' · ') ||
                          undefined
                        }
                        footerEnd={
                          v.is_active ? undefined : (
                            <span className="text-label">Inactivo</span>
                          )
                        }
                        key={v.id}
                        plate={v.plate}
                        title={`${v.brand.name} ${v.model}`}
                        to={`/vehicles/${v.id}`}
                      />
                    ))}
                    {canManageVehicles && (
                      <Link
                        className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line-dashed bg-surface-subtle p-4 text-center text-body font-semibold text-ink-muted transition-colors hover:border-ink/40 hover:text-ink"
                        to={`/vehicles/new?owner_id=${customer.id}&owner_name=${encodeURIComponent(customer.name)}`}
                      >
                        <Plus aria-hidden="true" size={20} />
                        Registrar otro vehículo
                      </Link>
                    )}
                  </div>
                )}
              </DetailCard>
            ),
          },
          ...(access.commercialPurchases || access.artisanPurchases
            ? [
                {
                  id: 'compras',
                  label: 'Historial',
                  content: (
                    <CustomerPurchases
                      customer={customer}
                      permissions={permissions}
                    />
                  ),
                },
              ]
            : []),
          ...(access.commercialDebt || access.artisanDebt
            ? [
                {
                  id: 'deuda',
                  label: 'Deuda',
                  content: (
                    <CustomerDebt
                      customerId={customer.id}
                      permissions={permissions}
                    />
                  ),
                },
              ]
            : []),
          {
            id: 'datos',
            label: 'Datos',
            content: (
              <DetailCard
                badge={
                  <StatusBadge
                    label={customer.is_active ? 'Activo' : 'Inactivo'}
                    tone={customer.is_active ? 'success' : 'neutral'}
                  />
                }
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
                ]}
                title="Datos de identificación y contacto"
              />
            ),
          },
        ]}
        onChange={(id) =>
          setParams(
            (current) => {
              const next = new URLSearchParams(current)
              if (id === 'vehiculos') next.delete('tab')
              else next.set('tab', id)
              return next
            },
            { replace: true },
          )
        }
        panelClassName="pt-4"
      />

      {maintenanceOpen && (
        <NewMaintenanceDialog
          initialSearch={customer.name}
          onClose={() => setMaintenanceOpen(false)}
          open
        />
      )}

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

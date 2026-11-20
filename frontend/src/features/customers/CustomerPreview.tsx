import {
  EnvelopeSimple,
  IdentificationCard,
  Phone,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { documentDate, OrderStateBadge } from '@/features/maintenance/format'
import { useMaintenanceOrders } from '@/features/maintenance/hooks'
import { useCustomerVehicles } from '@/features/vehicles/hooks'
import {
  Avatar,
  Button,
  Money,
  PlateTag,
  SkeletonRows,
  StatusBadge,
} from '@/shared/ui'

import { useCustomerAccountSummary } from './accounts'
import { BusinessAmounts, owed } from './BusinessAmounts'
import { useCustomer } from './hooks'

const linkButton =
  'ui-button inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-4 text-body font-semibold whitespace-nowrap transition-colors'

function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-subtle text-ink-muted"
      >
        {icon}
      </span>
      <span className="min-w-0 leading-snug">
        <span className="block text-label text-ink-muted">{label}</span>
        <span className="block font-semibold break-words">{children}</span>
      </span>
    </div>
  )
}

function Mini({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-group border border-line px-3.5 py-2.5">
      <p className="text-label text-ink-muted">{label}</p>
      <div className="mt-0.5 font-semibold">{children}</div>
    </div>
  )
}

/**
 * Vista previa del cliente elegido en la lista: datos de contacto, lo de este año y lo que debe
 * en cada negocio, sus vehículos y sus últimos mantenimientos, con los accesos de uso diario.
 * Cada dato económico viene del servidor y se muestra solo con su permiso.
 */
export function CustomerPreview({
  customerId,
  onNewMaintenance,
}: {
  customerId: number
  onNewMaintenance: ((name: string) => void) | null
}) {
  const permissions = new Set(useSession().data?.permissions ?? [])
  const customerQuery = useCustomer(customerId)
  const summary = useCustomerAccountSummary(customerId).data
  const vehicles = useCustomerVehicles(customerId)
  const canSeeOrders = permissions.has('mantenimientos.ver')
  const orders = useMaintenanceOrders({ customerId, pageSize: 3 }, canSeeOrders)

  const customer = customerQuery.data
  if (customerQuery.isPending) return <SkeletonRows rows={4} />
  if (!customer)
    return (
      <p className="text-body text-ink-muted">
        No fue posible cargar este cliente.
      </p>
    )

  const debtArtisan = owed(summary?.artisan?.balance)
  const debtCommercial = owed(summary?.commercial?.balance)
  const hasDebt = Boolean(debtArtisan || debtCommercial)
  const canSeeDebt =
    summary?.artisan?.balance != null || summary?.commercial?.balance != null
  const canSeeSpent =
    summary?.artisan?.spent_year != null ||
    summary?.commercial?.spent_year != null
  const since = new Date(customer.created_at).getFullYear()
  const payTo = debtCommercial
    ? `/sales/receivables?customer_id=${customer.id}`
    : `/maintenance/receivables?customer_id=${customer.id}`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-12 text-block" name={customer.name} size="36" />
        <div className="min-w-0 flex-1">
          <p className="text-label text-ink-muted">
            {customer.person_type === 'JURIDICA' ? 'Empresa' : 'Persona'} ·
            cliente desde {since}
            {!customer.is_active && ' · inactivo'}
          </p>
          <h2 className="text-figure font-bold break-words">{customer.name}</h2>
        </div>
        <Link
          className={`${linkButton} border-line-strong text-ink hover:bg-surface-subtle`}
          to={`/customers/${customer.id}`}
        >
          Abrir ficha completa
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <Fact
            icon={<IdentificationCard size={18} />}
            label={customer.identification_type === 'RUC' ? 'RUC' : 'Cédula'}
          >
            <span className="code">{customer.identification}</span>
          </Fact>
          <Fact icon={<Phone size={18} />} label="Teléfono">
            <span className="code">{customer.phone}</span>
          </Fact>
          <Fact
            icon={<EnvelopeSimple size={18} />}
            label="Correo para facturas"
          >
            {customer.email || (
              <span className="font-normal text-ink-muted">Sin correo</span>
            )}
          </Fact>
          {(canSeeSpent || canSeeDebt) && (
            <div className="grid grid-cols-2 gap-2.5">
              {canSeeSpent && (
                <Mini label="Este año">
                  <BusinessAmounts
                    artisan={summary?.artisan?.spent_year}
                    commercial={summary?.commercial?.spent_year}
                  />
                </Mini>
              )}
              {canSeeDebt && (
                <Mini label="Debe">
                  <BusinessAmounts
                    artisan={debtArtisan}
                    className="text-danger"
                    commercial={debtCommercial}
                    empty="Nada"
                  />
                </Mini>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-label font-semibold text-ink-muted">
              Vehículos
            </p>
            {vehicles.isPending ? (
              <SkeletonRows rows={1} />
            ) : (vehicles.data?.results.length ?? 0) === 0 ? (
              <p className="text-body text-ink-muted">
                Compra solo en mostrador.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {vehicles.data?.results.map((vehicle) => (
                  <li className="flex items-center gap-2.5" key={vehicle.id}>
                    <PlateTag plate={vehicle.plate} />
                    <span className="min-w-0 truncate text-body">
                      {vehicle.brand.name} {vehicle.model}
                      {vehicle.year ? ` ${vehicle.year}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {canSeeOrders && (
            <div>
              <p className="mb-2 text-label font-semibold text-ink-muted">
                Lo último
              </p>
              {orders.isPending ? (
                <SkeletonRows rows={2} />
              ) : (orders.data?.results.length ?? 0) === 0 ? (
                <p className="text-body text-ink-muted">
                  Todavía no tiene mantenimientos.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {orders.data?.results.map((order) => (
                    <li key={order.id}>
                      <Link
                        className="flex items-center gap-3 py-2 text-body hover:text-accent"
                        to={`/maintenance/${order.id}`}
                      >
                        <span className="w-20 shrink-0 text-label text-ink-muted">
                          {documentDate(order.opened_on)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          Mantenimiento {order.vehicle.plate}
                        </span>
                        <OrderStateBadge state={order.state} />
                        <Money
                          amount={order.services_total}
                          className="font-semibold"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 border-t border-line pt-4">
        {onNewMaintenance && customer.is_active && (
          <Button onClick={() => onNewMaintenance(customer.name)} type="button">
            Nuevo mantenimiento
          </Button>
        )}
        {permissions.has('ventas.crear') && customer.is_active && (
          <Link
            className={`${linkButton} border-ink text-ink hover:bg-ink hover:text-white`}
            to={`/sales/quick?customer=${encodeURIComponent(customer.identification)}`}
          >
            Venta rápida
          </Link>
        )}
        {hasDebt && (
          <Link
            className={`${linkButton} border-transparent text-accent hover:bg-accent-soft`}
            to={payTo}
          >
            Registrar pago
          </Link>
        )}
        {!customer.is_active && (
          <StatusBadge label="Cliente inactivo" tone="neutral" />
        )}
      </div>
    </div>
  )
}

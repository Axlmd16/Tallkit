import { AddressBook, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { useCustomerDebtors, type Debtor } from '@/features/customers/accounts'
import { BusinessAmounts, owed } from '@/features/customers/BusinessAmounts'
import { CustomerPreview } from '@/features/customers/CustomerPreview'
import { useCustomers } from '@/features/customers/hooks'
import type { PersonType } from '@/features/customers/types'
import { NewMaintenanceDialog } from '@/features/maintenance/NewMaintenanceDialog'
import {
  Avatar,
  Button,
  EmptyState,
  InlineNotice,
  LoadingState,
  MasterDetail,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
} from '@/shared/ui'

/** Fila de la lista: un cliente de la búsqueda o un deudor, con lo que debe en cada negocio. */
interface Row {
  id: number
  name: string
  identification: string
  personType: PersonType
  isActive: boolean
  artisan: string | null
  commercial: string | null
}

type Segment = '' | 'debt' | 'companies'

/** Letra con que se agrupa: la inicial sin tilde; lo que no empieza con letra va en «#». */
export function groupLetter(name: string): string {
  const first = name.trim().charAt(0).toLocaleUpperCase('es')
  if (first === 'Ñ') return first
  const plain = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return /^[A-Z]$/.test(plain) ? plain : '#'
}

function fromDebtor(debtor: Debtor): Row {
  return {
    id: debtor.customer_id,
    name: debtor.name,
    identification: debtor.identification,
    personType: debtor.person_type,
    isActive: true,
    artisan: owed(debtor.artisan),
    commercial: owed(debtor.commercial),
  }
}

/**
 * Clientes en maestro y detalle: a la izquierda la lista agrupada por letra, con búsqueda y los
 * segmentos Todos, Con deuda y Empresas; a la derecha el cliente elegido. La deuda de cada
 * negocio se muestra por separado y la calcula el servidor.
 */
export function CustomersPage() {
  const navigate = useNavigate()
  const filters = useUrlFilters()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canManage = permissions.has('clientes.gestionar')
  const canSeeDebt =
    permissions.has('pagos_comerciales.ver') ||
    permissions.has('pagos_artesanales.ver')
  const canOpenMaintenance = permissions.has('mantenimientos.gestionar')

  const segment = filters.get('segment') as Segment
  const [searchInput, setSearchInput] = useState(filters.search)
  const [maintenanceFor, setMaintenanceFor] = useState<string | null>(null)

  const customers = useCustomers({
    search: filters.search || undefined,
    personType: segment === 'companies' ? 'JURIDICA' : undefined,
    page: filters.page,
  })
  const debtors = useCustomerDebtors(canSeeDebt)
  const debtById = new Map(
    (debtors.data?.items ?? []).map((debtor) => [debtor.customer_id, debtor]),
  )
  const debtorCount = (debtors.data?.items ?? []).filter(
    (debtor) => owed(debtor.artisan) || owed(debtor.commercial),
  ).length

  const term = filters.search.trim().toLocaleLowerCase('es')
  const rows: Row[] =
    segment === 'debt'
      ? (debtors.data?.items ?? [])
          .map(fromDebtor)
          .filter((row) => row.artisan || row.commercial)
          .filter(
            (row) =>
              !term ||
              row.name.toLocaleLowerCase('es').includes(term) ||
              row.identification.includes(term),
          )
      : (customers.data?.results ?? []).map((customer) => {
          const debt = debtById.get(customer.id)
          return {
            id: customer.id,
            name: customer.name,
            identification: customer.identification,
            personType: customer.person_type,
            isActive: customer.is_active,
            artisan: owed(debt?.artisan),
            commercial: owed(debt?.commercial),
          }
        })

  const listQuery = segment === 'debt' ? debtors : customers
  const selectedParam = filters.get('ficha')
  const selectedKey =
    selectedParam && rows.some((row) => String(row.id) === selectedParam)
      ? selectedParam
      : rows[0]
        ? String(rows[0].id)
        : null
  const totalPages = segment === 'debt' ? 1 : (customers.data?.total_pages ?? 1)
  const currentPage = customers.data?.page ?? filters.page

  return (
    <section className="customers-page list-page space-y-4">
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => void navigate('/customers/new')}>
              <Plus aria-hidden="true" size={18} />
              Nuevo cliente
            </Button>
          ) : undefined
        }
        description="Elija un cliente para ver sus vehículos, lo que debe y lo último que hizo."
        icon={<AddressBook />}
        {...(customers.data && segment === '' && !filters.search
          ? {
              eyebrow:
                customers.data.count === 1
                  ? '1 cliente'
                  : `${customers.data.count} clientes`,
            }
          : {})}
        title="Clientes"
      />

      {listQuery.isPending ? (
        <LoadingState label="Cargando clientes…" />
      ) : listQuery.isError ? (
        <InlineNotice
          title="No fue posible cargar el listado de clientes."
          tone="danger"
        >
          Inténtelo nuevamente o revise la conexión.
        </InlineNotice>
      ) : rows.length === 0 && segment === '' && !filters.search ? (
        <EmptyState
          action={
            canManage ? (
              <Button onClick={() => void navigate('/customers/new')}>
                <Plus aria-hidden="true" size={18} />
                Registrar primer cliente
              </Button>
            ) : undefined
          }
          description="Aún no se han registrado clientes en el sistema."
          title="No hay clientes registrados"
        />
      ) : (
        <MasterDetail<Row>
          backLabel="Volver a clientes"
          detailLabel="Cliente elegido"
          emptyDetail="Elija un cliente de la lista para ver su detalle."
          emptyList="No hay clientes que coincidan con la búsqueda."
          getGroup={(row) => groupLetter(row.name)}
          getKey={(row) => String(row.id)}
          items={rows}
          listLabel="Lista de clientes"
          onSelect={(key) => filters.set({ ficha: key })}
          renderDetail={(row) => (
            <CustomerPreview
              customerId={row.id}
              key={row.id}
              onNewMaintenance={
                canOpenMaintenance ? (name) => setMaintenanceFor(name) : null
              }
            />
          )}
          renderItem={(row) => (
            <span className="flex items-center gap-3">
              <Avatar name={row.name} size="36" />
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block truncate font-semibold">{row.name}</span>
                <span className="code text-label text-ink-muted">
                  {row.identification}
                  {!row.isActive && ' · inactivo'}
                </span>
              </span>
              {(row.artisan || row.commercial) && (
                <BusinessAmounts
                  artisan={row.artisan}
                  className="text-label font-semibold text-danger"
                  commercial={row.commercial}
                />
              )}
            </span>
          )}
          selectedKey={selectedKey}
          toolbar={
            <div className="flex flex-col gap-3">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  filters.set({ search: searchInput.trim(), ficha: '' })
                }}
                role="search"
              >
                <SearchInput
                  aria-label="Buscar cliente"
                  onChange={(event) => setSearchInput(event.target.value)}
                  onClear={() => {
                    setSearchInput('')
                    filters.set({ search: '', ficha: '' })
                  }}
                  placeholder="Nombre, cédula, RUC o teléfono"
                  value={searchInput}
                  variant="underline"
                />
              </form>
              <SegmentedControl
                aria-label="Filtrar clientes"
                onChange={(value) => filters.set({ segment: value, ficha: '' })}
                options={[
                  { value: '', label: 'Todos' },
                  ...(canSeeDebt
                    ? [
                        {
                          value: 'debt',
                          label: 'Con deuda',
                          ...(debtors.data ? { count: debtorCount } : {}),
                        },
                      ]
                    : []),
                  { value: 'companies', label: 'Empresas' },
                ]}
                value={segment}
              />
            </div>
          }
        />
      )}

      {segment !== 'debt' && totalPages > 1 && (
        <Pagination
          onNext={() => filters.set({ page: currentPage + 1 })}
          onPrevious={() => filters.set({ page: currentPage - 1 })}
          page={currentPage}
          totalPages={totalPages}
        />
      )}

      {maintenanceFor !== null && (
        <NewMaintenanceDialog
          initialSearch={maintenanceFor}
          onClose={() => setMaintenanceFor(null)}
          open
        />
      )}
    </section>
  )
}

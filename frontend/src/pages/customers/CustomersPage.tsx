import {
  Eye,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Power,
  XCircle,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { useCustomerMutations, useCustomers } from '@/features/customers/hooks'
import type {
  CustomerFilters,
  CustomerSummary,
  CustomerWrite,
} from '@/features/customers/types'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  Dialog,
  Drawer,
  ElevatedDataList,
  EmptyState,
  Field,
  FilterPanel,
  InlineNotice,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  RowActions,
  Select,
  StatusBadge,
  Toolbar,
} from '@/shared/ui'

type Confirmation = {
  kind: 'activate' | 'deactivate'
  customer: CustomerSummary
}

type Notice = { text: string; tone: 'success' | 'danger' }

export function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const canManage = permissions.has('clientes.gestionar')
  const canDeactivate = permissions.has('clientes.desactivar')

  const searchParam = searchParams.get('search') ?? ''
  const isActiveParam = searchParams.get('is_active')
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10) || 1

  const isActiveFilter: boolean | undefined =
    isActiveParam === 'true'
      ? true
      : isActiveParam === 'false'
        ? false
        : undefined

  const [searchInput, setSearchInput] = useState(searchParam)
  const [editing, setEditing] = useState<CustomerSummary | null | undefined>()
  const [formDirty, setFormDirty] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const filters: CustomerFilters = {
    search: searchParam || undefined,
    isActive: isActiveFilter,
    page: pageParam,
  }

  const customersQuery = useCustomers(filters)
  const mutations = useCustomerMutations()

  function updateFilters(updates: {
    search?: string
    is_active?: string
    page?: number
  }) {
    const next = new URLSearchParams(searchParams)
    if (updates.search !== undefined) {
      if (updates.search.trim()) next.set('search', updates.search.trim())
      else next.delete('search')
      next.delete('page')
    }
    if (updates.is_active !== undefined) {
      if (updates.is_active) next.set('is_active', updates.is_active)
      else next.delete('is_active')
      next.delete('page')
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) next.set('page', String(updates.page))
      else next.delete('page')
    }
    setSearchParams(next)
  }

  function clearFilters() {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  async function saveCustomer(data: CustomerWrite) {
    if (editing) {
      await mutations.update.mutateAsync({ id: editing.id, data })
      setNotice({ text: 'Cliente actualizado correctamente.', tone: 'success' })
    } else {
      await mutations.create.mutateAsync(data)
      setNotice({ text: 'Cliente registrado correctamente.', tone: 'success' })
    }
    setEditing(undefined)
    setFormDirty(false)
  }

  async function runConfirmation() {
    if (!confirmation) return
    const { kind, customer } = confirmation
    setConfirmation(null)
    setNotice(null)
    try {
      if (kind === 'deactivate') {
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

  const columns = [
    {
      header: 'Nombre / Razón social',
      key: 'name' as const,
      priority: 'primary' as const,
      render: (row: CustomerSummary) => (
        <div>
          <Link
            className="font-bold text-primary hover:underline"
            to={`/customers/${row.id}`}
          >
            {row.name}
          </Link>
          <span className="block text-xs text-ink-muted">
            {row.person_type === 'JURIDICA'
              ? 'Persona jurídica'
              : 'Persona natural'}
          </span>
        </div>
      ),
    },
    {
      header: 'Identificación',
      key: 'identification' as const,
      priority: 'primary' as const,
      render: (row: CustomerSummary) => (
        <span>
          <span className="font-semibold">{row.identification_type}:</span>{' '}
          {row.identification}
        </span>
      ),
    },
    {
      header: 'Teléfono',
      key: 'phone' as const,
      priority: 'secondary' as const,
    },
    {
      header: 'Estado',
      key: 'is_active' as const,
      priority: 'secondary' as const,
      render: (row: CustomerSummary) => (
        <StatusBadge
          label={row.is_active ? 'Activo' : 'Inactivo'}
          tone={row.is_active ? 'success' : 'neutral'}
        />
      ),
    },
  ]

  const hasActiveFilters = Boolean(searchParam || isActiveParam)
  const results = customersQuery.data?.results ?? []
  const totalPages = customersQuery.data?.total_pages ?? 1
  const currentPage = customersQuery.data?.page ?? pageParam

  return (
    <div className="customers-page space-y-6">
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => setEditing(null)}>
              <Plus aria-hidden="true" size={20} />
              Nuevo cliente
            </Button>
          ) : undefined
        }
        description="Registro compartido de clientes y contactos para todas las actividades del taller."
        title="Clientes"
      />

      {notice && <InlineNotice title={notice.text} tone={notice.tone} />}

      <FilterPanel label="Filtros de búsqueda de clientes">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault()
            updateFilters({ search: searchInput })
          }}
        >
          <Field id="customer-search-input" label="Buscar cliente">
            <Input
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nombre, identificación o teléfono…"
              value={searchInput}
            />
          </Field>

          <Field id="customer-status-filter" label="Estado">
            <Select
              onChange={(e) => updateFilters({ is_active: e.target.value })}
              value={isActiveParam ?? ''}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </Field>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
            <Toolbar label="Acciones de filtro">
              <Button type="submit" variant="secondary">
                <MagnifyingGlass aria-hidden="true" size={18} />
                Buscar
              </Button>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="quiet">
                  <XCircle aria-hidden="true" size={18} />
                  Limpiar filtros
                </Button>
              )}
            </Toolbar>
          </div>
        </form>
      </FilterPanel>

      {customersQuery.isPending && <LoadingState label="Cargando clientes…" />}

      {customersQuery.isError && (
        <InlineNotice
          title="No fue posible cargar el listado de clientes."
          tone="danger"
        >
          Inténtelo nuevamente o revise la conexión.
        </InlineNotice>
      )}

      {customersQuery.isSuccess && results.length === 0 && (
        <EmptyState
          action={
            hasActiveFilters ? (
              <Button onClick={clearFilters} variant="secondary">
                Limpiar filtros
              </Button>
            ) : canManage ? (
              <Button onClick={() => setEditing(null)}>
                <Plus aria-hidden="true" size={20} />
                Registrar primer cliente
              </Button>
            ) : undefined
          }
          description={
            hasActiveFilters
              ? 'No hay clientes que coincidan con los filtros aplicados.'
              : 'Aún no se han registrado clientes en el sistema.'
          }
          title={
            hasActiveFilters ? 'Sin resultados' : 'No hay clientes registrados'
          }
        />
      )}

      {customersQuery.isSuccess && results.length > 0 && (
        <>
          <ElevatedDataList
            actions={(row) => (
              <RowActions>
                <Link
                  className="ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-group border px-4 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px border-transparent bg-transparent text-ink-muted hover:bg-surface-selected hover:text-primary"
                  to={`/customers/${row.id}`}
                >
                  <Eye aria-hidden="true" size={18} />
                  Ver ficha
                </Link>
                {canManage && (
                  <Button onClick={() => setEditing(row)} variant="quiet">
                    <PencilSimple aria-hidden="true" size={18} />
                    Editar
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    onClick={() =>
                      setConfirmation({
                        kind: row.is_active ? 'deactivate' : 'activate',
                        customer: row,
                      })
                    }
                    variant={row.is_active ? 'danger' : 'secondary'}
                  >
                    <Power aria-hidden="true" size={18} />
                    {row.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                )}
              </RowActions>
            )}
            columns={columns}
            getRowKey={(row) => row.id}
            label="Clientes"
            rows={results}
          />

          <Pagination
            onNext={() => updateFilters({ page: currentPage + 1 })}
            onPrevious={() => updateFilters({ page: currentPage - 1 })}
            page={currentPage}
            totalPages={totalPages}
          />
        </>
      )}

      <Drawer
        description={
          editing
            ? 'Actualice los datos del cliente.'
            : 'Ingrese los datos para registrar un nuevo cliente.'
        }
        onClose={() => {
          if (
            !formDirty ||
            window.confirm('Hay cambios sin guardar. ¿Desea descartarlos?')
          ) {
            setEditing(undefined)
            setFormDirty(false)
          }
        }}
        open={editing !== undefined}
        title={editing ? `Editar cliente: ${editing.name}` : 'Nuevo cliente'}
      >
        <CustomerForm
          customer={editing ?? undefined}
          onCancel={() => {
            setEditing(undefined)
            setFormDirty(false)
          }}
          onDirtyChange={setFormDirty}
          onNavigateToCustomer={(id) => {
            setEditing(undefined)
            navigate(`/customers/${id}`)
          }}
          onSubmit={saveCustomer}
        />
      </Drawer>

      <Dialog
        description={
          confirmation?.kind === 'deactivate'
            ? `Al desactivar a «${confirmation.customer.name}», no podrá ser seleccionado como propietario en nuevas operaciones. Su historial y vehículos vigentes se conservarán.`
            : `Al reactivar a «${confirmation?.customer.name}», volverá a estar disponible para nuevas asociaciones con su misma información.`
        }
        onClose={() => setConfirmation(null)}
        open={confirmation !== null}
        title={
          confirmation?.kind === 'deactivate'
            ? 'Desactivar cliente'
            : 'Activar cliente'
        }
      >
        <Toolbar label="Confirmación de estado">
          <Button
            onClick={() => void runConfirmation()}
            variant={confirmation?.kind === 'deactivate' ? 'danger' : 'primary'}
          >
            {confirmation?.kind === 'deactivate'
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

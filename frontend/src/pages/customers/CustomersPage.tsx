import {
  EnvelopeSimple,
  MagnifyingGlass,
  MapPin,
  PencilSimple,
  Plus,
  Power,
  Phone,
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
  ConfirmationPanel,
  Drawer,
  ElevatedDataList,
  EmptyState,
  Field,
  FilterPanel,
  InlineNotice,
  LoadingState,
  PageHeader,
  Pagination,
  RowActions,
  SearchInput,
  Select,
  StatusBadge,
  Toolbar,
  Avatar,
} from '@/shared/ui'

type Confirmation = {
  kind: 'activate' | 'deactivate'
  customer: CustomerSummary
}

type Notice = { text: string; tone: 'success' | 'danger' }

const primaryButtonLinkClass =
  'ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-group border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-primary-strong hover:bg-primary-strong active:translate-y-px'

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
  const [previewing, setPreviewing] = useState<CustomerSummary | null>(null)

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
        <div className="user-identity">
          <Avatar
            className={`person-avatar avatar-${row.id % 4}`}
            name={row.name}
            size="36"
          />
          <div className="min-w-0">
            <button
              className="break-words font-semibold text-primary hover:underline"
              onClick={() => setPreviewing(row)}
              type="button"
            >
              {row.name}
            </button>
            <p className="break-words text-sm text-ink-muted">
              {row.person_type === 'JURIDICA'
                ? 'Persona jurídica'
                : 'Persona natural'}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Identificación',
      key: 'identification' as const,
      priority: 'primary' as const,
      render: (row: CustomerSummary) => (
        <div className="space-y-1">
          <p>{row.identification}</p>
          <StatusBadge
            kind="category"
            label={row.identification_type === 'RUC' ? 'RUC' : 'Cédula'}
            shape="rectangle"
            showIcon={false}
            tone={row.identification_type === 'RUC' ? 'info' : 'neutral'}
          />
        </div>
      ),
    },
    {
      header: 'Teléfono',
      key: 'phone' as const,
      priority: 'secondary' as const,
    },
    {
      header: 'Correo',
      key: 'email' as const,
      priority: 'secondary' as const,
      render: (row: CustomerSummary) => (
        <span className={row.email ? 'user-email' : 'italic text-ink-muted'}>
          {row.email || 'Sin correo electrónico'}
        </span>
      ),
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
    <section className="customers-page list-page">
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
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            updateFilters({ search: searchInput })
          }}
        >
          <Field id="customer-search-input" label="Buscar cliente">
            <SearchInput
              onChange={(e) => setSearchInput(e.target.value)}
              onClear={() => {
                setSearchInput('')
                updateFilters({ search: '' })
              }}
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

          <div className="flex items-end gap-2">
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
                {canManage && (
                  <Button
                    aria-label="Editar"
                    className="record-action"
                    onClick={() => setEditing(row)}
                    title="Editar"
                    variant="quiet"
                  >
                    <PencilSimple aria-hidden="true" size={18} />
                    <span>Editar</span>
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    aria-label={row.is_active ? 'Desactivar' : 'Activar'}
                    className="record-action"
                    onClick={() =>
                      setConfirmation({
                        kind: row.is_active ? 'deactivate' : 'activate',
                        customer: row,
                      })
                    }
                    title={row.is_active ? 'Desactivar' : 'Activar'}
                    variant={row.is_active ? 'danger' : 'secondary'}
                  >
                    <Power aria-hidden="true" size={18} />
                    <span>{row.is_active ? 'Desactivar' : 'Activar'}</span>
                  </Button>
                )}
              </RowActions>
            )}
            columns={columns}
            getRowKey={(row) => row.id}
            label="Clientes"
            onRowClick={setPreviewing}
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
        className="customer-preview-drawer"
        description="Información disponible del cliente seleccionado."
        onClose={() => setPreviewing(null)}
        open={previewing !== null}
        title="Detalle del cliente"
      >
        {previewing && (
          <div className="space-y-7">
            <div className="flex flex-col items-center text-center">
              <Avatar
                className={`person-avatar avatar-${previewing.id % 4}`}
                name={previewing.name}
                size="70"
              />
              <h3 className="mt-4 text-xl font-bold text-ink">
                {previewing.name}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {previewing.person_type === 'JURIDICA'
                  ? 'Persona jurídica'
                  : 'Persona natural'}
              </p>
              <div className="mt-3">
                <StatusBadge
                  label={previewing.is_active ? 'Activo' : 'Inactivo'}
                  tone={previewing.is_active ? 'success' : 'neutral'}
                />
              </div>
            </div>

            <section aria-labelledby="customer-contact-title">
              <h3
                className="text-base font-bold text-ink"
                id="customer-contact-title"
              >
                Información de contacto
              </h3>
              <div className="mt-3 divide-y divide-line border-y border-line">
                <div className="flex items-start gap-3 py-4">
                  <EnvelopeSimple
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-ink-muted"
                    size={20}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-muted">
                      Correo electrónico
                    </p>
                    <p className="mt-1 break-words text-sm text-ink">
                      {previewing.email || 'No registrado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-4">
                  <Phone
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-ink-muted"
                    size={20}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-muted">
                      Teléfono
                    </p>
                    <p className="mt-1 text-sm text-ink">{previewing.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-4">
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-ink-muted"
                    size={20}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-muted">
                      Dirección
                    </p>
                    <p className="mt-1 break-words text-sm text-ink">
                      {previewing.address || 'No registrada'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="customer-identification-title">
              <h3
                className="text-base font-bold text-ink"
                id="customer-identification-title"
              >
                Identificación
              </h3>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-group bg-surface-subtle p-3">
                <span className="text-sm text-ink">
                  {previewing.identification}
                </span>
                <StatusBadge
                  kind="category"
                  label={
                    previewing.identification_type === 'RUC' ? 'RUC' : 'Cédula'
                  }
                  shape="rectangle"
                  showIcon={false}
                  tone={
                    previewing.identification_type === 'RUC'
                      ? 'info'
                      : 'neutral'
                  }
                />
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Link
                className={primaryButtonLinkClass}
                to={`/customers/${previewing.id}`}
              >
                Ver ficha completa
              </Link>
              {canManage && (
                <Button
                  onClick={() => {
                    setEditing(previewing)
                    setPreviewing(null)
                  }}
                  variant="secondary"
                >
                  <PencilSimple aria-hidden="true" size={18} />
                  Editar cliente
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        className="customer-drawer"
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

      <ConfirmationPanel
        cancelLabel="Cancelar"
        confirmLabel={
          confirmation?.kind === 'deactivate'
            ? 'Confirmar desactivación'
            : 'Confirmar activación'
        }
        description={
          confirmation?.kind === 'deactivate'
            ? `Al desactivar a «${confirmation.customer.name}», no podrá ser seleccionado como propietario en nuevas operaciones. Su historial y vehículos vigentes se conservarán.`
            : `Al reactivar a «${confirmation?.customer.name}», volverá a estar disponible para nuevas asociaciones con su misma información.`
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void runConfirmation()}
        open={confirmation !== null}
        title={
          confirmation?.kind === 'deactivate'
            ? 'Desactivar cliente'
            : 'Activar cliente'
        }
        tone={confirmation?.kind === 'deactivate' ? 'danger' : 'primary'}
      />
    </section>
  )
}

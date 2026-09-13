import {
  Eye,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Power,
  XCircle,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useVehicleBrands } from '@/features/vehicle-brands/hooks'
import { useVehicleMutations, useVehicles } from '@/features/vehicles/hooks'
import type {
  VehicleCreate,
  VehicleFilters,
  VehicleSummary,
  VehicleUpdate,
} from '@/features/vehicles/types'
import { VehicleForm } from '@/features/vehicles/VehicleForm'
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
  vehicle: VehicleSummary
}

type Notice = { text: string; tone: 'success' | 'danger' }

export function VehiclesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const canManage = permissions.has('vehiculos.gestionar')
  const canDeactivate = permissions.has('vehiculos.desactivar')

  const searchParam = searchParams.get('search') ?? ''
  const isActiveParam = searchParams.get('is_active')
  const brandIdParam = searchParams.get('brand_id')
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10) || 1

  const isActiveFilter: boolean | undefined =
    isActiveParam === 'true'
      ? true
      : isActiveParam === 'false'
        ? false
        : undefined

  const brandIdFilter: number | undefined = brandIdParam
    ? parseInt(brandIdParam, 10) || undefined
    : undefined

  const [searchInput, setSearchInput] = useState(searchParam)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleSummary | null>(
    null,
  )
  const [formDirty, setFormDirty] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const filters: VehicleFilters = {
    search: searchParam || undefined,
    isActive: isActiveFilter,
    brandId: brandIdFilter,
    page: pageParam,
  }

  const vehiclesQuery = useVehicles(filters)
  const brandsQuery = useVehicleBrands({ isActive: true, pageSize: 100 })
  const brands = brandsQuery.data?.results ?? []

  const mutations = useVehicleMutations()

  const updateFilters = (changes: {
    search?: string | undefined
    is_active?: string | undefined
    brand_id?: string | undefined
    page?: number | undefined
  }) => {
    const next = new URLSearchParams(searchParams)
    if (changes.search !== undefined) {
      if (changes.search) next.set('search', changes.search)
      else next.delete('search')
      next.delete('page')
    }
    if (changes.is_active !== undefined) {
      if (changes.is_active) next.set('is_active', changes.is_active)
      else next.delete('is_active')
      next.delete('page')
    }
    if (changes.brand_id !== undefined) {
      if (changes.brand_id) next.set('brand_id', changes.brand_id)
      else next.delete('brand_id')
      next.delete('page')
    }
    if (changes.page !== undefined) {
      if (changes.page > 1) next.set('page', String(changes.page))
      else next.delete('page')
    }
    setSearchParams(next)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: searchInput.trim() })
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  const handleOpenCreate = () => {
    setEditingVehicle(null)
    setDrawerOpen(true)
  }

  const handleOpenEdit = (vehicle: VehicleSummary) => {
    setEditingVehicle(vehicle)
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    if (formDirty) {
      const confirmed = window.confirm(
        'Tiene cambios sin guardar. ¿Desea descartarlos?',
      )
      if (!confirmed) return
    }
    setDrawerOpen(false)
    setEditingVehicle(null)
    setFormDirty(false)
  }

  const handleCancel = () => {
    setDrawerOpen(false)
    setEditingVehicle(null)
    setFormDirty(false)
  }

  const handleSaveVehicle = async (
    data: VehicleCreate | (VehicleUpdate & { id: number }),
  ) => {
    if ('id' in data) {
      const { id, ...updateData } = data
      await mutations.updateVehicle.mutateAsync({ id, data: updateData })
      setNotice({
        text: 'Vehículo actualizado correctamente.',
        tone: 'success',
      })
    } else {
      await mutations.createVehicle.mutateAsync(data)
      setNotice({
        text: 'Vehículo registrado correctamente.',
        tone: 'success',
      })
    }
    setDrawerOpen(false)
    setEditingVehicle(null)
    setFormDirty(false)
  }

  const handleConfirmStateChange = async () => {
    if (!confirmation) return
    const { kind, vehicle } = confirmation
    setConfirmation(null)
    setNotice(null)
    try {
      if (kind === 'deactivate') {
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

  const hasActiveFilters =
    Boolean(searchParam) || isActiveParam !== null || brandIdParam !== null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehículos"
        description="Gestión y consulta del catálogo de vehículos registrados y sus propietarios."
        actions={
          canManage && (
            <Button
              variant="primary"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2"
            >
              <Plus size={18} weight="bold" />
              <span>Registrar vehículo</span>
            </Button>
          )
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

      <Toolbar label="Herramientas de búsqueda y filtros de vehículos">
        <FilterPanel label="Filtros de búsqueda de vehículos">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-1 flex-wrap items-end gap-3"
          >
            <div className="min-w-[240px] flex-1">
              <Field
                label="Buscar vehículos"
                hint="Por placa, modelo, VIN o propietario"
              >
                <div className="relative">
                  <Input
                    aria-label="Buscar vehículos"
                    placeholder="Placa, modelo, VIN o propietario…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    aria-label="Ejecutar búsqueda"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  >
                    <MagnifyingGlass size={18} />
                  </button>
                </div>
              </Field>
            </div>

            <div className="w-44">
              <Field label="Marca">
                <Select
                  aria-label="Filtrar por marca"
                  value={brandIdParam ?? ''}
                  onChange={(e) =>
                    updateFilters({ brand_id: e.target.value || '' })
                  }
                >
                  <option value="">Todas las marcas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="w-36">
              <Field label="Estado">
                <Select
                  aria-label="Filtrar por estado"
                  value={isActiveParam ?? ''}
                  onChange={(e) =>
                    updateFilters({ is_active: e.target.value || '' })
                  }
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </Select>
              </Field>
            </div>

            {hasActiveFilters && (
              <Button
                variant="quiet"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5"
              >
                <XCircle size={16} />
                <span>Limpiar filtros</span>
              </Button>
            )}
          </form>
        </FilterPanel>
      </Toolbar>

      {vehiclesQuery.isLoading ? (
        <LoadingState label="Cargando vehículos…" />
      ) : vehiclesQuery.isError ? (
        <InlineNotice tone="danger" title="Error de conexión">
          No fue posible cargar el listado de vehículos. Intente nuevamente.
        </InlineNotice>
      ) : vehiclesQuery.data && vehiclesQuery.data.results.length === 0 ? (
        <EmptyState
          title="No se encontraron vehículos"
          description={
            hasActiveFilters
              ? 'No hay vehículos que coincidan con los filtros aplicados.'
              : 'Aún no hay vehículos registrados en el taller.'
          }
          action={
            canManage && !hasActiveFilters ? (
              <Button variant="primary" onClick={handleOpenCreate}>
                Registrar primer vehículo
              </Button>
            ) : undefined
          }
        />
      ) : vehiclesQuery.data ? (
        <div className="space-y-4">
          <ElevatedDataList<VehicleSummary>
            label="Vehículos"
            rows={vehiclesQuery.data.results}
            getRowKey={(v) => v.id}
            columns={[
              {
                header: 'Placa',
                key: 'plate',
                priority: 'primary',
                render: (v) => (
                  <span className="font-mono font-bold text-ink">
                    {v.plate}
                  </span>
                ),
              },
              {
                header: 'Vehículo',
                key: 'model',
                priority: 'primary',
                render: (v) => (
                  <div>
                    <p className="font-medium text-ink">
                      {v.brand.name} {v.model}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {v.color || 'Sin color'} {v.year ? `• Año ${v.year}` : ''}
                    </p>
                  </div>
                ),
              },
              {
                header: 'Propietario',
                key: 'current_owner',
                priority: 'secondary',
                render: (v) =>
                  v.current_owner ? (
                    <Link
                      to={`/customers/${v.current_owner.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {v.current_owner.name}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">Sin propietario</span>
                  ),
              },
              {
                header: 'VIN / Chasis',
                key: 'vin',
                priority: 'secondary',
                render: (v) => (
                  <span className="font-mono text-xs text-ink-muted">
                    {v.vin || '—'}
                  </span>
                ),
              },
              {
                header: 'Estado',
                key: 'is_active',
                priority: 'secondary',
                render: (v) => (
                  <StatusBadge
                    label={v.is_active ? 'Activo' : 'Inactivo'}
                    tone={v.is_active ? 'success' : 'neutral'}
                  />
                ),
              },
            ]}
            actions={(v) => (
              <RowActions>
                <Link
                  to={`/vehicles/${v.id}`}
                  className="ui-button inline-flex min-h-10 items-center justify-center gap-1.5 rounded-group border border-transparent bg-transparent px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-selected hover:text-primary"
                >
                  <Eye size={16} />
                  <span>Ver ficha</span>
                </Link>
                {canManage && (
                  <Button
                    variant="quiet"
                    onClick={() => handleOpenEdit(v)}
                    className="inline-flex items-center gap-1.5 text-xs"
                  >
                    <PencilSimple size={16} />
                    <span>Editar</span>
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    variant={v.is_active ? 'danger' : 'secondary'}
                    onClick={() =>
                      setConfirmation({
                        kind: v.is_active ? 'deactivate' : 'activate',
                        vehicle: v,
                      })
                    }
                    className="inline-flex items-center gap-1.5 text-xs"
                  >
                    <Power size={16} />
                    <span>{v.is_active ? 'Desactivar' : 'Activar'}</span>
                  </Button>
                )}
              </RowActions>
            )}
          />

          <Pagination
            page={vehiclesQuery.data.page}
            totalPages={vehiclesQuery.data.total_pages}
            onPrevious={() =>
              updateFilters({
                page: Math.max(1, (vehiclesQuery.data?.page ?? 1) - 1),
              })
            }
            onNext={() =>
              updateFilters({
                page: (vehiclesQuery.data?.page ?? 1) + 1,
              })
            }
          />
        </div>
      ) : null}

      {/* Drawer para registro y edición */}
      <Drawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        title={editingVehicle ? 'Editar vehículo' : 'Registrar vehículo'}
        description={
          editingVehicle
            ? `Modifique los datos técnicos del vehículo con placa ${editingVehicle.plate}.`
            : 'Ingrese los datos técnicos y asigne el cliente propietario.'
        }
      >
        <VehicleForm
          vehicle={editingVehicle ?? undefined}
          onSubmit={handleSaveVehicle}
          onCancel={handleCancel}
          onDirtyChange={setFormDirty}
        />
      </Drawer>

      {/* Diálogo para confirmación de cambio de estado */}
      <Dialog
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={
          confirmation?.kind === 'deactivate'
            ? 'Desactivar vehículo'
            : 'Activar vehículo'
        }
        description={
          confirmation?.kind === 'deactivate'
            ? `Al desactivar el vehículo «${confirmation.vehicle.plate}», conservará su historial de propietarios pero no podrá ser utilizado en nuevas operaciones activas.`
            : `Al reactivar el vehículo «${confirmation?.vehicle.plate}», volverá a estar disponible para operaciones activas.`
        }
      >
        <Toolbar label="Confirmación de estado de vehículo">
          <Button
            variant={confirmation?.kind === 'deactivate' ? 'danger' : 'primary'}
            onClick={() => void handleConfirmStateChange()}
          >
            {confirmation?.kind === 'deactivate'
              ? 'Confirmar desactivación'
              : 'Confirmar activación'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmation(null)}>
            Cancelar
          </Button>
        </Toolbar>
      </Dialog>
    </div>
  )
}

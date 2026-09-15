import {
  CalendarBlank,
  CarSimple,
  MagnifyingGlass,
  Palette,
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
import exampleVehiclePhoto from '@/assets/ejemplo/ejemplo.jpg'
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
  ConfirmationPanel,
  Drawer,
  ElevatedDataList,
  EmptyState,
  Field,
  FilterPanel,
  InlineNotice,
  LoadingState,
  MediaSlot,
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
  const [previewing, setPreviewing] = useState<VehicleSummary | null>(null)

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
    <section className="vehicles-page list-page">
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

      <FilterPanel label="Filtros de búsqueda de vehículos">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-[minmax(20rem,30rem)_12rem_10rem_auto]"
        >
          <Field label="Buscar vehículos">
            <SearchInput
              aria-label="Buscar vehículos"
              onChange={(e) => setSearchInput(e.target.value)}
              onClear={() => {
                setSearchInput('')
                updateFilters({ search: '' })
              }}
              placeholder="Placa, modelo, VIN o propietario…"
              value={searchInput}
            />
          </Field>

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

          <Toolbar label="Acciones de filtro">
            <Button type="submit" variant="secondary">
              <MagnifyingGlass aria-hidden="true" size={18} />
              Buscar
            </Button>
            {hasActiveFilters && (
              <Button
                variant="quiet"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5"
              >
                <XCircle aria-hidden="true" size={16} />
                <span>Limpiar filtros</span>
              </Button>
            )}
          </Toolbar>
        </form>
      </FilterPanel>

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
            hasActiveFilters ? (
              <Button variant="secondary" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            ) : canManage ? (
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
            onRowClick={setPreviewing}
            columns={[
              {
                header: 'Placa',
                key: 'plate',
                priority: 'primary',
                render: (v) => (
                  <span className="inline-flex rounded-control bg-surface-subtle px-2.5 py-1 font-mono text-sm font-bold tracking-wide text-ink">
                    {v.plate}
                  </span>
                ),
              },
              {
                header: 'Vehículo',
                key: 'model',
                priority: 'primary',
                render: (v) => (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                      <CarSimple aria-hidden="true" size={17} weight="fill" />
                    </span>
                    <p className="min-w-0 truncate font-semibold text-ink">
                      {v.brand.name} {v.model}
                    </p>
                  </div>
                ),
              },
              {
                header: 'Color',
                key: 'color',
                priority: 'secondary',
                render: (v) =>
                  v.color ? (
                    <span className="inline-flex items-center gap-2 text-ink">
                      <Palette
                        aria-hidden="true"
                        className="text-ink-muted"
                        size={17}
                      />
                      {v.color}
                    </span>
                  ) : (
                    <span className="italic text-ink-muted">No registrado</span>
                  ),
              },
              {
                header: 'Año',
                key: 'year',
                priority: 'secondary',
                render: (v) =>
                  v.year ? (
                    <span className="inline-flex items-center gap-2 font-semibold tabular-nums text-ink">
                      <CalendarBlank
                        aria-hidden="true"
                        className="text-ink-muted"
                        size={17}
                      />
                      <span>{v.year}</span>
                    </span>
                  ) : (
                    <span className="italic text-ink-muted">No registrado</span>
                  ),
              },
              {
                header: 'Propietario',
                key: 'current_owner',
                priority: 'secondary',
                render: (v) =>
                  v.current_owner ? (
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        className={`person-avatar avatar-${v.current_owner.id % 4}`}
                        name={v.current_owner.name}
                        size="36"
                      />
                      <div className="min-w-0">
                        <Link
                          to={`/customers/${v.current_owner.id}`}
                          className="block wrap-break-word font-semibold text-primary hover:underline"
                        >
                          {v.current_owner.name}
                        </Link>
                        <p className="mt-0.5 wrap-break-word text-xs text-ink-muted">
                          {v.current_owner.identification}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-ink-muted">Sin propietario</span>
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
              <RowActions className="flex-nowrap">
                {canManage && (
                  <Button
                    aria-label="Editar"
                    title="Editar"
                    variant="quiet"
                    onClick={() => handleOpenEdit(v)}
                    className="record-action inline-flex items-center gap-1.5 text-xs"
                  >
                    <PencilSimple size={16} />
                    <span>Editar</span>
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    aria-label={v.is_active ? 'Desactivar' : 'Activar'}
                    title={v.is_active ? 'Desactivar' : 'Activar'}
                    variant={v.is_active ? 'danger' : 'secondary'}
                    onClick={() =>
                      setConfirmation({
                        kind: v.is_active ? 'deactivate' : 'activate',
                        vehicle: v,
                      })
                    }
                    className="record-action inline-flex items-center gap-1.5 text-xs"
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

      <Drawer
        className="vehicle-preview-drawer"
        description="Información disponible del vehículo seleccionado."
        onClose={() => setPreviewing(null)}
        open={previewing !== null}
        title="Detalle del vehículo"
      >
        {previewing && (
          <div className="space-y-7">
            <div className="flex flex-col items-center text-center">
              <MediaSlot
                aspectRatio="4:3"
                className="max-w-70"
                label="Foto del vehículo no disponible"
              >
                <img
                  alt="Foto de ejemplo del vehículo"
                  className="size-full object-cover"
                  src={exampleVehiclePhoto}
                />
              </MediaSlot>
              <h3 className="mt-4 text-xl font-bold text-ink">
                {previewing.brand.name} {previewing.model}
              </h3>
              <p className="mt-1 font-mono text-sm font-semibold tracking-wide text-ink-muted">
                {previewing.plate}
              </p>
              <div className="mt-3">
                <StatusBadge
                  label={previewing.is_active ? 'Activo' : 'Inactivo'}
                  tone={previewing.is_active ? 'success' : 'neutral'}
                />
              </div>
            </div>

            <section aria-labelledby="vehicle-details-title">
              <h3
                className="text-base font-bold text-ink"
                id="vehicle-details-title"
              >
                Datos del vehículo
              </h3>
              <div className="mt-3 divide-y divide-line border-y border-line">
                <div className="flex items-center justify-between gap-3 py-4">
                  <span className="text-xs font-semibold text-ink-muted">
                    Color
                  </span>
                  <span className="text-sm text-ink">
                    {previewing.color || 'No registrado'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-4">
                  <span className="text-xs font-semibold text-ink-muted">
                    Año
                  </span>
                  <span className="text-sm tabular-nums text-ink">
                    {previewing.year || 'No registrado'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 py-4">
                  <span className="text-xs font-semibold text-ink-muted">
                    VIN / Chasis
                  </span>
                  <span className="max-w-48 break-all text-right font-mono text-xs text-ink">
                    {previewing.vin || 'No registrado'}
                  </span>
                </div>
              </div>
            </section>

            <section aria-labelledby="vehicle-owner-title">
              <h3
                className="text-base font-bold text-ink"
                id="vehicle-owner-title"
              >
                Propietario actual
              </h3>
              <div className="mt-3 flex items-center gap-3 rounded-group bg-surface-subtle p-3">
                {previewing.current_owner ? (
                  <>
                    <Avatar
                      className={`person-avatar avatar-${previewing.current_owner.id % 4}`}
                      name={previewing.current_owner.name}
                      size="36"
                    />
                    <div className="min-w-0">
                      <Link
                        className="font-semibold text-primary hover:underline"
                        to={`/customers/${previewing.current_owner.id}`}
                      >
                        {previewing.current_owner.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {previewing.current_owner.identification}
                      </p>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-ink-muted">
                    Sin propietario asignado
                  </span>
                )}
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Link
                className="ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-group border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-primary-strong hover:bg-primary-strong active:translate-y-px"
                to={`/vehicles/${previewing.id}`}
              >
                Ver ficha completa
              </Link>
              {canManage && (
                <Button
                  onClick={() => {
                    setEditingVehicle(previewing)
                    setPreviewing(null)
                    setDrawerOpen(true)
                  }}
                  variant="secondary"
                >
                  <PencilSimple aria-hidden="true" size={18} />
                  Editar vehículo
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Drawer para registro y edición */}
      <Drawer
        className="vehicle-drawer"
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
      <ConfirmationPanel
        open={confirmation !== null}
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
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void handleConfirmStateChange()}
        confirmLabel={
          confirmation?.kind === 'deactivate'
            ? 'Confirmar desactivación'
            : 'Confirmar activación'
        }
        cancelLabel="Cancelar"
        tone={confirmation?.kind === 'deactivate' ? 'danger' : 'primary'}
      />
    </section>
  )
}

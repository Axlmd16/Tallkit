import {
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Power,
  XCircle,
  Tag,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  useVehicleBrandMutations,
  useVehicleBrands,
} from '@/features/vehicle-brands/hooks'
import type {
  VehicleBrandFilters,
  VehicleBrandSummary,
} from '@/features/vehicle-brands/types'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  Dialog,
  ElevatedDataList,
  EmptyState,
  Field,
  FilterPanel,
  FormModal,
  InlineNotice,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  RowActions,
  Select,
  StatusBadge,
  Toolbar,
  useToast,
} from '@/shared/ui'

type Confirmation = {
  kind: 'activate' | 'deactivate'
  brand: VehicleBrandSummary
}

type Notice = { text: string; tone: 'danger' }

export function VehicleBrandsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const canManage = permissions.has('marcas_vehiculo.gestionar')
  const canDeactivate = permissions.has('marcas_vehiculo.desactivar')

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
  const [editing, setEditing] = useState<
    VehicleBrandSummary | null | undefined
  >()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const toast = useToast()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const filters: VehicleBrandFilters = {
    search: searchParam || undefined,
    isActive: isActiveFilter,
    page: pageParam,
  }

  const brandsQuery = useVehicleBrands(filters)
  const mutations = useVehicleBrandMutations()

  const updateFilters = (changes: {
    search?: string | undefined
    is_active?: string | undefined
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

  const handleClearSearch = () => {
    setSearchInput('')
    updateFilters({ search: '' })
  }

  const openEditor = (brand: VehicleBrandSummary | null) => {
    setEditing(brand)
    setName(brand?.name ?? '')
    setNameError('')
  }

  const closeEditor = () => {
    setEditing(undefined)
    setNameError('')
  }

  /** Guarda la marca; devuelve `false` si hay un dato que corregir junto al campo. */
  const saveBrand = async (): Promise<boolean> => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('El nombre de la marca es obligatorio.')
      return false
    }
    if (trimmed.length > 255) {
      setNameError('El nombre de la marca no puede exceder 255 caracteres.')
      return false
    }
    setNameError('')
    try {
      if (editing && editing.id) {
        await mutations.updateBrand.mutateAsync({
          id: editing.id,
          data: { name: trimmed, expected_version: editing.version },
        })
        toast.success(`Marca «${trimmed}» actualizada.`)
      } else {
        await mutations.createBrand.mutateAsync({ name: trimmed })
        toast.success(`Marca «${trimmed}» creada.`)
      }
    } catch (err) {
      const fieldMessage =
        err instanceof ProblemError ? err.errors?.name?.[0] : undefined
      if (fieldMessage) {
        setNameError(fieldMessage)
        return false
      }
      throw err
    }
    return true
  }

  const handleConfirmState = async () => {
    if (!confirmation) return
    const { kind, brand } = confirmation
    try {
      if (kind === 'deactivate') {
        await mutations.deactivateBrand.mutateAsync({
          id: brand.id,
          expectedVersion: brand.version,
        })
        toast.success(`Marca «${brand.name}» desactivada.`)
      } else {
        await mutations.activateBrand.mutateAsync({
          id: brand.id,
          expectedVersion: brand.version,
        })
        toast.success(`Marca «${brand.name}» reactivada.`)
      }
      setConfirmation(null)
    } catch (err) {
      if (err instanceof ProblemError) {
        setNotice({ text: err.message, tone: 'danger' })
      } else {
        setNotice({
          text: 'No fue posible actualizar el estado de la marca.',
          tone: 'danger',
        })
      }
      setConfirmation(null)
    }
  }

  const brandPage = brandsQuery.data
  const brands = brandPage?.results ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Tag />}
        title="Marcas"
        description="Catálogo de marcas homologadas para vehículos atendidos en el taller."
      />

      {notice && (
        <InlineNotice tone="danger" title="No se completó la operación">
          {notice.text}
        </InlineNotice>
      )}

      <Toolbar label="Barra de herramientas de marcas">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-1 flex-wrap items-end gap-3"
        >
          <div className="min-w-[240px] flex-1">
            <Field id="brand-search" label="Buscar marca">
              <div className="relative">
                <Input
                  id="brand-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por nombre..."
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                    aria-label="Limpiar búsqueda"
                  >
                    <XCircle size={18} weight="fill" />
                  </button>
                )}
              </div>
            </Field>
          </div>
          <Button type="submit" variant="secondary">
            <MagnifyingGlass size={16} />
            Buscar
          </Button>
        </form>

        <FilterPanel label="Filtros de marcas">
          <div className="w-44">
            <Field id="brand-status" label="Estado">
              <Select
                id="brand-status"
                value={
                  isActiveFilter === true
                    ? 'active'
                    : isActiveFilter === false
                      ? 'inactive'
                      : 'all'
                }
                onChange={(e) => {
                  const val = e.target.value
                  updateFilters({
                    is_active:
                      val === 'active'
                        ? 'true'
                        : val === 'inactive'
                          ? 'false'
                          : '',
                  })
                }}
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </Select>
            </Field>
          </div>
        </FilterPanel>

        {canManage && (
          <div className="ml-auto">
            <Button
              type="button"
              variant="primary"
              onClick={() => openEditor(null)}
            >
              <Plus size={16} weight="bold" />
              Nueva marca
            </Button>
          </div>
        )}
      </Toolbar>

      {brandsQuery.isPending && (
        <LoadingState label="Cargando catálogo de marcas..." />
      )}

      {brandsQuery.isError && (
        <InlineNotice tone="danger" title="Error de carga">
          No fue posible consultar las marcas. Por favor, reintente más tarde.
        </InlineNotice>
      )}

      {brandsQuery.isSuccess && brands.length === 0 && (
        <EmptyState
          title="No hay marcas registradas"
          description={
            searchParam || isActiveParam
              ? 'No se encontraron marcas que coincidan con los filtros aplicados.'
              : 'El catálogo de marcas aún no tiene registros.'
          }
        />
      )}

      {brandsQuery.isSuccess && brands.length > 0 && (
        <div className="space-y-4">
          <ElevatedDataList<VehicleBrandSummary>
            label="Marcas de vehículo"
            rows={brands}
            getRowKey={(b) => b.id}
            columns={[
              {
                header: 'Nombre',
                key: 'name',
                priority: 'primary',
                render: (b) => (
                  <span className="font-semibold text-ink">{b.name}</span>
                ),
              },
              {
                header: 'Estado',
                key: 'is_active',
                priority: 'secondary',
                render: (b) => (
                  <StatusBadge
                    label={b.is_active ? 'Activo' : 'Inactivo'}
                    tone={b.is_active ? 'success' : 'neutral'}
                  />
                ),
              },
              {
                header: 'Versión',
                key: 'version',
                priority: 'secondary',
                render: (b) => (
                  <span className="code text-label text-ink-muted">
                    v{b.version}
                  </span>
                ),
              },
            ]}
            actions={(b) => (
              <RowActions>
                {canManage && (
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => openEditor(b)}
                  >
                    <PencilSimple size={15} />
                    Editar
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() =>
                      setConfirmation({
                        kind: b.is_active ? 'deactivate' : 'activate',
                        brand: b,
                      })
                    }
                  >
                    <Power size={15} />
                    {b.is_active ? 'Desactivar' : 'Reactivar'}
                  </Button>
                )}
              </RowActions>
            )}
          />

          {brandPage && brandPage.total_pages > 1 && (
            <Pagination
              page={brandPage.page}
              totalPages={brandPage.total_pages}
              onNext={() => updateFilters({ page: brandPage.page + 1 })}
              onPrevious={() => updateFilters({ page: brandPage.page - 1 })}
            />
          )}
        </div>
      )}

      <FormModal
        description={
          editing
            ? 'Modifique el nombre homologado de la marca.'
            : 'Se podrá elegir al registrar vehículos y compatibilidades.'
        }
        createAnotherLabel="Guardar y crear otra"
        dirty={name !== (editing?.name ?? '')}
        onClose={closeEditor}
        onSave={saveBrand}
        {...(editing
          ? {}
          : {
              onSaveAndCreateAnother: async () => {
                const saved = await saveBrand()
                if (saved) setName('')
                return saved
              },
            })}
        open={editing !== undefined}
        saveLabel={editing ? 'Guardar cambios' : 'Guardar marca'}
        title={editing ? 'Editar marca' : 'Nueva marca de vehículo'}
      >
        <Field
          error={nameError || undefined}
          id="brand-name"
          label="Nombre de la marca"
        >
          <Input
            autoFocus
            id="brand-name"
            maxLength={255}
            onChange={(event) => {
              setName(event.target.value)
              if (nameError) setNameError('')
            }}
            placeholder="Ej. Toyota, Chevrolet, Ford"
            value={name}
          />
        </Field>
      </FormModal>

      <Dialog
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={
          confirmation?.kind === 'deactivate'
            ? 'Desactivar marca'
            : 'Reactivar marca'
        }
        description={
          confirmation?.kind === 'deactivate'
            ? `¿Está seguro de desactivar la marca "${confirmation?.brand.name}"? Los vehículos que ya la utilizan conservarán su marca, pero no podrá seleccionarse para nuevos vehículos.`
            : `¿Desea reactivar la marca "${confirmation?.brand.name}" para que esté disponible en nuevos registros?`
        }
      >
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="quiet"
            onClick={() => setConfirmation(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant={confirmation?.kind === 'deactivate' ? 'danger' : 'primary'}
            onClick={handleConfirmState}
          >
            {confirmation?.kind === 'deactivate'
              ? 'Confirmar desactivación'
              : 'Confirmar reactivación'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

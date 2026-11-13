import { PencilSimple, Power, Truck } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  CatalogToolbar,
  NewRecordButton,
} from '@/features/catalog-common/CatalogToolbar'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { useSupplierMutations, useSuppliers } from '@/features/suppliers/hooks'
import type { Supplier } from '@/features/suppliers/types'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Avatar,
  Button,
  ElevatedDataList,
  FiscalScopeBadge,
  PageHeader,
  RowActions,
  StatusBadge,
  useToast,
} from '@/shared/ui'

const contact = (supplier: Supplier) =>
  [supplier.phone, supplier.email].filter(Boolean).join(' · ') || '—'

export function SuppliersPage() {
  const filters = useUrlFilters()
  const canManage = new Set(useSession().data?.permissions ?? []).has(
    'proveedores.gestionar',
  )
  const tracker = useIntentTracker()
  const mutations = useSupplierMutations()
  const navigate = useNavigate()
  const [change, setChange] = useState<StateChange | null>(null)
  const toast = useToast()

  const query = useSuppliers({
    search: filters.search || undefined,
    isActive: filters.isActive,
    page: filters.page,
  })

  async function changeState(target: StateChange) {
    await tracker.run({ op: 'state', ...target }, (key) =>
      mutations.setActive.mutateAsync({
        id: target.id,
        active: target.active,
        expectedVersion: target.version,
        key,
      }),
    )
    toast.success(
      `Proveedor «${target.name}» ${target.active ? 'reactivado' : 'desactivado'}.`,
    )
  }

  return (
    <div className="catalog-page list-page space-y-6">
      <PageHeader
        icon={<Truck />}
        description="Proveedores del ámbito comercial. Solo el nombre es obligatorio; identificación y contacto son opcionales."
        title="Proveedores"
        actions={
          canManage && (
            <NewRecordButton
              label="Nuevo proveedor"
              onClick={() => void navigate('/suppliers/new')}
            />
          )
        }
      />
      <FiscalScopeBadge scope="commercial" />
      <ListStates
        toolbar={
          <CatalogToolbar
            filters={filters}
            idPrefix="supplier"
            label="Barra de herramientas de proveedores"
            searchLabel="Buscar por nombre o documento"
            searchPlaceholder="Nombre o documento…"
          />
        }
        emptyText="Aún no hay proveedores registrados."
        emptyTitle="No hay proveedores"
        errorText="No fue posible consultar los proveedores. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando proveedores…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<Supplier>
            actions={(row) =>
              canManage && (
                <RowActions>
                  <Button
                    aria-label="Editar"
                    className="record-action"
                    onClick={() => {
                      void navigate(`/suppliers/${row.id}/edit`)
                    }}
                    type="button"
                    title="Editar"
                    variant="quiet"
                  >
                    <PencilSimple aria-hidden="true" size={18} />
                    <span>Editar</span>
                  </Button>
                  <Button
                    aria-label={row.is_active ? 'Desactivar' : 'Reactivar'}
                    className="record-action"
                    onClick={() =>
                      setChange({
                        id: row.id,
                        name: row.name,
                        version: row.version,
                        active: !row.is_active,
                      })
                    }
                    type="button"
                    title={row.is_active ? 'Desactivar' : 'Reactivar'}
                    variant={row.is_active ? 'danger' : 'secondary'}
                  >
                    <Power aria-hidden="true" size={18} />
                    <span>{row.is_active ? 'Desactivar' : 'Reactivar'}</span>
                  </Button>
                </RowActions>
              )
            }
            columns={[
              {
                header: 'Nombre',
                key: 'name',
                priority: 'primary',
                render: (row) => (
                  <span className="user-identity font-semibold text-ink">
                    <Avatar
                      className={`person-avatar avatar-${row.id % 4}`}
                      name={row.name}
                      size="36"
                    />
                    {row.name}
                  </span>
                ),
              },
              {
                header: 'Identificación',
                key: 'identification',
                priority: 'secondary',
                render: (row) =>
                  row.identification
                    ? `${row.identification_type} ${row.identification}`
                    : '—',
              },
              {
                header: 'Contacto',
                key: 'phone',
                priority: 'secondary',
                render: contact,
              },
              {
                header: 'Estado',
                key: 'is_active',
                priority: 'secondary',
                render: (row) => (
                  <StatusBadge
                    label={row.is_active ? 'Activo' : 'Inactivo'}
                    tone={row.is_active ? 'success' : 'neutral'}
                  />
                ),
              },
            ]}
            getRowKey={(row) => row.id}
            label="Proveedores"
            onRowClick={(row) =>
              void navigate(`/suppliers/${row.id}`, {
                state: { from: window.location.search },
              })
            }
            rows={rows}
          />
        )}
      </ListStates>
      <StateChangeDialog
        activateText={`¿Reactivar «${change?.name ?? ''}»? Volverá a poder seleccionarse en operaciones nuevas.`}
        change={change}
        deactivateText={`¿Desactivar «${change?.name ?? ''}»? Conserva su identidad y referencias, pero no se podrá seleccionar en operaciones nuevas.`}
        noun="proveedor"
        onClose={() => setChange(null)}
        onConfirm={changeState}
      />
    </div>
  )
}

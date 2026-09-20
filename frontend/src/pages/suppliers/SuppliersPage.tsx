import { Pencil, Power } from '@phosphor-icons/react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { CatalogToolbar } from '@/features/catalog-common/CatalogToolbar'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { ListStates } from '@/features/catalog-common/ListStates'
import {
  StateChangeDialog,
  type StateChange,
} from '@/features/catalog-common/StateChangeDialog'
import { SupplierEditorDrawer } from '@/features/suppliers/SupplierEditorDrawer'
import { useSupplierMutations, useSuppliers } from '@/features/suppliers/hooks'
import type { Supplier } from '@/features/suppliers/types'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  ElevatedDataList,
  FiscalScopeBadge,
  InlineNotice,
  PageHeader,
  RowActions,
  StatusBadge,
} from '@/shared/ui'

const contact = (supplier: Supplier) =>
  [supplier.phone, supplier.email].filter(Boolean).join(' · ') || '—'

export function SuppliersPage() {
  const filters = useUrlFilters()
  const location = useLocation()
  const navigate = useNavigate()
  const canManage = new Set(useSession().data?.permissions ?? []).has(
    'proveedores.gestionar',
  )
  const tracker = useIntentTracker()
  const mutations = useSupplierMutations()
  const [editor, setEditor] = useState<'new' | Supplier | null>(null)
  const [change, setChange] = useState<StateChange | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
    setNotice(
      `Proveedor «${target.name}» ${target.active ? 'reactivado' : 'desactivado'}.`,
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Proveedores del ámbito comercial. Solo el nombre es obligatorio; identificación y contacto son opcionales."
        title="Proveedores"
      />
      <FiscalScopeBadge scope="commercial" />
      {notice && (
        <InlineNotice title="Operación exitosa" tone="success">
          {notice}
        </InlineNotice>
      )}
      <CatalogToolbar
        filters={filters}
        idPrefix="supplier"
        label="Barra de herramientas de proveedores"
        newLabel="Nuevo proveedor"
        onNew={
          canManage
            ? () => {
                setNotice(null)
                setEditor('new')
              }
            : undefined
        }
        searchLabel="Buscar por nombre o documento"
        searchPlaceholder="Nombre o documento…"
      />
      <ListStates
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
                    onClick={() => {
                      setNotice(null)
                      setEditor(row)
                    }}
                    type="button"
                    variant="quiet"
                  >
                    <Pencil aria-hidden="true" size={15} />
                    Editar
                  </Button>
                  <Button
                    onClick={() =>
                      setChange({
                        id: row.id,
                        name: row.name,
                        version: row.version,
                        active: !row.is_active,
                      })
                    }
                    type="button"
                    variant="quiet"
                  >
                    <Power aria-hidden="true" size={15} />
                    {row.is_active ? 'Desactivar' : 'Reactivar'}
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
                  <span className="font-semibold text-ink">{row.name}</span>
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
              navigate(`/suppliers/${row.id}`, {
                state: { from: location.search },
              })
            }
            rows={rows}
          />
        )}
      </ListStates>
      <SupplierEditorDrawer
        mode={editor}
        onClose={() => setEditor(null)}
        onSaved={setNotice}
      />
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

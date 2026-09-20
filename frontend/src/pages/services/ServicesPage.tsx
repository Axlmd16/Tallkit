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
import { useServiceMutations, useServices } from '@/features/services/hooks'
import { ServiceEditorDrawer } from '@/features/services/ServiceEditorDrawer'
import type { Service } from '@/features/services/types'
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

export function ServicesPage() {
  const filters = useUrlFilters()
  const location = useLocation()
  const navigate = useNavigate()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canManage = permissions.has('servicios.gestionar')
  const tracker = useIntentTracker()
  const mutations = useServiceMutations()
  const [editor, setEditor] = useState<'new' | Service | null>(null)
  const [change, setChange] = useState<StateChange | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useServices({
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
      `Servicio «${target.name}» ${target.active ? 'reactivado' : 'desactivado'}.`,
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Catálogo de servicios del taller con precio referencial final en USD. No maneja existencias."
        title="Servicios"
      />
      <FiscalScopeBadge scope="artesanal" />
      {notice && (
        <InlineNotice title="Operación exitosa" tone="success">
          {notice}
        </InlineNotice>
      )}
      <CatalogToolbar
        filters={filters}
        idPrefix="service"
        label="Barra de herramientas de servicios"
        newLabel="Nuevo servicio"
        onNew={
          canManage
            ? () => {
                setNotice(null)
                setEditor('new')
              }
            : undefined
        }
        searchLabel="Buscar servicio"
        searchPlaceholder="Buscar por nombre…"
      />
      <ListStates
        emptyText="Aún no hay servicios registrados."
        emptyTitle="No hay servicios"
        errorText="No fue posible consultar los servicios. Reintente en unos instantes."
        filtered={filters.filtered}
        loadingLabel="Cargando servicios…"
        onPage={(page) => filters.set({ page })}
        query={query}
      >
        {(rows) => (
          <ElevatedDataList<Service>
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
                header: 'Precio referencial',
                key: 'reference_price',
                priority: 'secondary',
                render: (row) => (
                  <span className="numeric">USD {row.reference_price}</span>
                ),
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
            label="Servicios"
            onRowClick={(row) =>
              navigate(`/services/${row.id}`, {
                state: { from: location.search },
              })
            }
            rows={rows}
          />
        )}
      </ListStates>
      <ServiceEditorDrawer
        mode={editor}
        onClose={() => setEditor(null)}
        onSaved={setNotice}
      />
      <StateChangeDialog
        activateText={`¿Reactivar «${change?.name ?? ''}»? Volverá a poder seleccionarse en operaciones nuevas.`}
        change={change}
        deactivateText={`¿Desactivar «${change?.name ?? ''}»? Conserva su identidad y referencias, pero no se podrá seleccionar en operaciones nuevas.`}
        noun="servicio"
        onClose={() => setChange(null)}
        onConfirm={changeState}
      />
    </div>
  )
}

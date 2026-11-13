import { PencilSimple, Power, Toolbox, Wrench } from '@phosphor-icons/react'
import { useState } from 'react'

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
import { useServiceMutations, useServices } from '@/features/services/hooks'
import { ServiceEditorModal } from '@/features/services/ServiceEditorModal'
import { ServicePreview } from '@/features/services/ServicePreview'
import type { Service } from '@/features/services/types'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  DataTable,
  Drawer,
  FiscalScopeBadge,
  PageHeader,
  RowActions,
  StatusBadge,
  useToast,
} from '@/shared/ui'

export function ServicesPage() {
  const filters = useUrlFilters()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canManage = permissions.has('servicios.gestionar')
  const tracker = useIntentTracker()
  const mutations = useServiceMutations()
  const [editor, setEditor] = useState<'new' | Service | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [change, setChange] = useState<StateChange | null>(null)
  const toast = useToast()

  const query = useServices({
    search: filters.search || undefined,
    isActive: filters.isActive,
    page: filters.page,
  })
  // La vista previa usa la fila vigente de la página: refleja ediciones y se cierra si sale de ella.
  const preview =
    query.data?.results.find((row) => row.id === previewId) ?? null

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
      `Servicio «${target.name}» ${target.active ? 'reactivado' : 'desactivado'}.`,
    )
  }

  return (
    <div className="catalog-page list-page space-y-6">
      <PageHeader
        icon={<Toolbox />}
        description="Catálogo de servicios del taller con precio referencial final en USD. No maneja existencias."
        title="Servicios"
        actions={
          canManage && (
            <NewRecordButton
              label="Nuevo servicio"
              onClick={() => {
                setEditor('new')
              }}
            />
          )
        }
      />
      <FiscalScopeBadge scope="artesanal" />
      <div className="gap-4 lg:flex lg:items-start">
        <div className="min-w-0 flex-1">
          <ListStates
            toolbar={
              <CatalogToolbar
                filters={filters}
                idPrefix="service"
                label="Barra de herramientas de servicios"
                searchLabel="Buscar servicio"
                searchPlaceholder="Buscar por nombre o código…"
              />
            }
            emptyText="Aún no hay servicios registrados."
            emptyTitle="No hay servicios"
            errorText="No fue posible consultar los servicios. Reintente en unos instantes."
            filtered={filters.filtered}
            loadingLabel="Cargando servicios…"
            onPage={(page) => filters.set({ page })}
            query={query}
          >
            {(rows) => (
              <DataTable<Service>
                actions={(row) =>
                  canManage && (
                    <RowActions>
                      <Button
                        aria-label="Editar"
                        className="record-action"
                        onClick={() => {
                          setEditor(row)
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
                        <span>
                          {row.is_active ? 'Desactivar' : 'Reactivar'}
                        </span>
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
                      <span className="flex items-center gap-2.5 font-semibold text-ink">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning-soft text-warning">
                          <Wrench aria-hidden="true" size={17} weight="fill" />
                        </span>
                        {row.name}
                      </span>
                    ),
                  },
                  {
                    header: 'Código',
                    key: 'code',
                    priority: 'secondary',
                    render: (row) => (
                      <span className="code text-body text-ink-muted">
                        {row.code}
                      </span>
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
                onRowClick={(row) => setPreviewId(row.id)}
                rows={rows}
                selectedKeys={preview ? [preview.id] : undefined}
                variant="elevated"
              />
            )}
          </ListStates>
        </div>
        <Drawer
          actions={
            canManage &&
            preview && (
              <>
                <Button
                  onClick={() => setEditor(preview)}
                  type="button"
                  variant="secondary"
                >
                  <PencilSimple aria-hidden="true" size={15} />
                  Editar
                </Button>
                <Button
                  onClick={() =>
                    setChange({
                      id: preview.id,
                      name: preview.name,
                      version: preview.version,
                      active: !preview.is_active,
                    })
                  }
                  type="button"
                  variant={preview.is_active ? 'danger' : 'primary'}
                >
                  <Power aria-hidden="true" size={15} />
                  {preview.is_active ? 'Desactivar' : 'Reactivar'}
                </Button>
              </>
            )
          }
          description="Vista previa del servicio"
          icon={<Wrench size={17} />}
          mode="docked"
          onClose={() => setPreviewId(null)}
          open={preview !== null}
          title={preview?.name ?? ''}
        >
          {preview && <ServicePreview service={preview} />}
        </Drawer>
      </div>
      <ServiceEditorModal
        mode={editor}
        onClose={() => setEditor(null)}
        onSaved={(message) => toast.success(message)}
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

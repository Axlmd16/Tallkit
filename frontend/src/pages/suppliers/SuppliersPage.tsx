import {
  EnvelopeSimple,
  IdentificationCard,
  MapPin,
  PencilSimple,
  Phone,
  Power,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router'

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
  Avatar,
  Button,
  Drawer,
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
  const canManage = new Set(useSession().data?.permissions ?? []).has(
    'proveedores.gestionar',
  )
  const tracker = useIntentTracker()
  const mutations = useSupplierMutations()
  const [editor, setEditor] = useState<'new' | Supplier | null>(null)
  const [previewing, setPreviewing] = useState<Supplier | null>(null)
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
    <div className="catalog-page list-page space-y-6">
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
                    aria-label="Editar"
                    className="record-action"
                    onClick={() => {
                      setNotice(null)
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
            onRowClick={setPreviewing}
            rows={rows}
          />
        )}
      </ListStates>
      <Drawer
        className="record-preview-drawer"
        description="Resumen del proveedor seleccionado."
        onClose={() => setPreviewing(null)}
        open={previewing !== null}
        title="Detalle del proveedor"
        width="409"
      >
        {previewing && (
          <div className="record-preview-content space-y-7">
            <div className="flex flex-col items-center text-center">
              <Avatar
                className={`person-avatar avatar-${previewing.id % 4}`}
                name={previewing.name}
                size="70"
              />
              <h3 className="mt-4 text-xl font-bold text-ink">
                {previewing.name}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">Proveedor comercial</p>
              <div className="mt-3">
                <StatusBadge
                  label={previewing.is_active ? 'Activo' : 'Inactivo'}
                  tone={previewing.is_active ? 'success' : 'neutral'}
                />
              </div>
            </div>
            <section aria-labelledby="supplier-preview-contact">
              <h3
                className="text-base font-bold text-ink"
                id="supplier-preview-contact"
              >
                Información de contacto
              </h3>
              <div className="preview-detail-list">
                <div>
                  <Phone size={19} />
                  <span>Teléfono</span>
                  <strong>{previewing.phone || 'No registrado'}</strong>
                </div>
                <div>
                  <EnvelopeSimple size={19} />
                  <span>Correo electrónico</span>
                  <strong>{previewing.email || 'No registrado'}</strong>
                </div>
                <div>
                  <MapPin size={19} />
                  <span>Dirección</span>
                  <strong>{previewing.address || 'No registrada'}</strong>
                </div>
              </div>
            </section>
            <section aria-labelledby="supplier-preview-id">
              <h3
                className="text-base font-bold text-ink"
                id="supplier-preview-id"
              >
                Identificación
              </h3>
              <div className="mt-3 flex items-center gap-3 rounded-group bg-surface-subtle p-3">
                <IdentificationCard className="text-primary" size={20} />
                <span className="flex-1 text-sm text-ink">
                  {previewing.identification || 'No registrada'}
                </span>
                {previewing.identification_type && (
                  <StatusBadge
                    kind="category"
                    label={previewing.identification_type}
                    shape="rectangle"
                    showIcon={false}
                    tone="info"
                  />
                )}
              </div>
            </section>
            <div className="flex flex-wrap gap-2">
              <Link
                className="preview-primary-link"
                to={`/suppliers/${previewing.id}`}
              >
                Ver ficha completa
              </Link>
              {canManage && (
                <Button
                  onClick={() => {
                    setEditor(previewing)
                    setPreviewing(null)
                  }}
                  variant="secondary"
                >
                  <PencilSimple aria-hidden="true" size={18} /> Editar proveedor
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
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

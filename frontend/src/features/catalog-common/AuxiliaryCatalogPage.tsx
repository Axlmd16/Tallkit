import { PencilSimple, Power } from '@phosphor-icons/react'
import { useState } from 'react'

import { useSession } from '@/features/auth/hooks'
import type { Page } from '@/shared/api/catalog-resource'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Drawer,
  ElevatedDataList,
  InlineNotice,
  PageHeader,
  RowActions,
  StatusBadge,
} from '@/shared/ui'

import { CatalogToolbar } from './CatalogToolbar'
import { useUrlFilters } from './filters'
import { ListStates } from './ListStates'
import { useReturnFocus } from './useReturnFocus'
import { RecordForm, type RecordValues, type TextFieldSpec } from './RecordForm'
import { StateChangeDialog, type StateChange } from './StateChangeDialog'

export interface AuxiliaryItem {
  id: number
  name: string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

interface ListFilters {
  search?: string | undefined
  isActive: 'true' | 'false' | 'all'
  page: number
}

interface Config<T extends AuxiliaryItem> {
  idPrefix: string
  title: string
  description: string
  /** «categoría», «unidad de medida», «marca de producto». */
  noun: string
  /** Género gramatical para «nueva/nuevo» y «desactivada/desactivado». */
  feminine: boolean
  nounPlural: string
  fields: TextFieldSpec[]
  /** Dato adicional mostrado en lista y ficha. */
  extraField?: { name: keyof T & string; label: string } | undefined
  deactivateText: (item: AuxiliaryItem) => string
  useList: (filters: ListFilters) => {
    isPending: boolean
    isError: boolean
    data?: Page<T> | undefined
  }
  useDetail: (id: number | null) => {
    data?: T | undefined
    isPending: boolean
    refetch: () => unknown
  }
  useMutations: () => {
    create: { mutateAsync: (v: { data: object; key: string }) => Promise<T> }
    update: {
      mutateAsync: (v: { id: number; data: object; key: string }) => Promise<T>
    }
    setActive: {
      mutateAsync: (v: {
        id: number
        active: boolean
        expectedVersion: number
        key: string
      }) => Promise<T>
    }
  }
}

function toValues<T extends AuxiliaryItem>(
  item: T,
  fields: TextFieldSpec[],
): RecordValues {
  return Object.fromEntries(
    fields.map((f) => [f.name, String((item as never)[f.name] ?? '')]),
  )
}

/** Lista, ficha en panel y formulario de un catálogo auxiliar de productos. */
export function AuxiliaryCatalogPage<T extends AuxiliaryItem>(
  config: Config<T>,
) {
  const { idPrefix, noun, feminine, fields, extraField } = config
  const filters = useUrlFilters()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canManage = permissions.has('productos.gestionar')
  const tracker = useIntentTracker()
  const mutations = config.useMutations()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [change, setChange] = useState<StateChange | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const fichaId = filters.getNumber('ficha') ?? null
  const list = config.useList({
    search: filters.search || undefined,
    isActive: filters.isActive,
    page: filters.page,
  })
  const detail = config.useDetail(fichaId)
  const item = detail.data
  const article = feminine ? 'la' : 'el'
  const created = feminine ? 'creada' : 'creado'
  const updated = feminine ? 'actualizada' : 'actualizado'

  function closePanel() {
    setCreating(false)
    setEditing(false)
    setDirty(false)
    if (fichaId) filters.set({ ficha: undefined })
  }

  async function save(values: RecordValues) {
    if (creating) {
      const data = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== ''),
      )
      const saved = await tracker.run({ op: 'create', data }, (key) =>
        mutations.create.mutateAsync({ data, key }),
      )
      setNotice(
        `${noun[0]!.toUpperCase()}${noun.slice(1)} «${saved.name}» ${created}.`,
      )
      closePanel()
      return
    }
    if (!item) return
    const original = toValues(item, fields)
    const changes = Object.fromEntries(
      Object.entries(values).filter(([name, v]) => v !== original[name]),
    )
    if (Object.keys(changes).length === 0) {
      setEditing(false)
      return
    }
    const data = { ...changes, expected_version: item.version }
    const saved = await tracker.run(
      { op: 'update', id: item.id, data },
      (key) => mutations.update.mutateAsync({ id: item.id, data, key }),
    )
    setNotice(
      `${noun[0]!.toUpperCase()}${noun.slice(1)} «${saved.name}» ${updated}.`,
    )
    setEditing(false)
    setDirty(false)
  }

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
      `${noun[0]!.toUpperCase()}${noun.slice(1)} «${target.name}» ${
        target.active ? 'reactivad' : 'desactivad'
      }${feminine ? 'a' : 'o'}.`,
    )
  }

  const stateAction = (row: AuxiliaryItem) =>
    canManage && (
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
    )

  const panelOpen = creating || fichaId !== null
  const returnFocus = useReturnFocus(panelOpen)

  return (
    <div className="space-y-6">
      <PageHeader description={config.description} title={config.title} />

      {notice && (
        <InlineNotice title="Operación exitosa" tone="success">
          {notice}
        </InlineNotice>
      )}

      <CatalogToolbar
        filters={filters}
        idPrefix={idPrefix}
        label={`Barra de herramientas de ${config.nounPlural}`}
        newLabel={`${feminine ? 'Nueva' : 'Nuevo'} ${noun}`}
        onNew={
          canManage
            ? () => {
                setNotice(null)
                setCreating(true)
              }
            : undefined
        }
        searchLabel={`Buscar ${noun}`}
        searchPlaceholder="Buscar por nombre…"
        statusLabels={{
          active: feminine ? 'Activas' : 'Activos',
          inactive: feminine ? 'Inactivas' : 'Inactivos',
        }}
      />

      <ListStates
        emptyText={`Aún no hay ${config.nounPlural} registrad${feminine ? 'a' : 'o'}s.`}
        emptyTitle={`No hay ${config.nounPlural}`}
        errorText={`No fue posible consultar ${config.nounPlural}. Reintente en unos instantes.`}
        filtered={filters.filtered}
        loadingLabel={`Cargando ${config.nounPlural}…`}
        onPage={(page) => filters.set({ page })}
        query={list}
      >
        {(rows) => (
          <ElevatedDataList<T>
            actions={(row) => (
              <RowActions>
                {canManage && (
                  <Button
                    onClick={() => {
                      setNotice(null)
                      setEditing(true)
                      filters.set({ ficha: row.id })
                    }}
                    type="button"
                    variant="quiet"
                  >
                    <PencilSimple aria-hidden="true" size={15} />
                    Editar
                  </Button>
                )}
                {stateAction(row)}
              </RowActions>
            )}
            columns={[
              {
                header: 'Nombre',
                key: 'name',
                priority: 'primary',
                render: (row) => (
                  <span className="font-semibold text-ink">{row.name}</span>
                ),
              },
              ...(extraField
                ? [
                    {
                      header: extraField.label,
                      key: extraField.name,
                      priority: 'secondary' as const,
                      render: (row: T) => (
                        <span className="text-ink-muted">
                          {String((row as never)[extraField.name] || '—')}
                        </span>
                      ),
                    },
                  ]
                : []),
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
            label={config.title}
            onRowClick={(row) => {
              setNotice(null)
              setEditing(false)
              filters.set({ ficha: row.id })
            }}
            rows={rows}
          />
        )}
      </ListStates>

      <Drawer
        description={
          creating
            ? `Complete los datos ${feminine ? 'de la nueva' : 'del nuevo'} ${noun}.`
            : editing
              ? `Modifique los datos ${feminine ? 'de la' : 'del'} ${noun}.`
              : `Ficha ${feminine ? 'de la' : 'del'} ${noun}.`
        }
        hasUnsavedChanges={dirty}
        onClose={closePanel}
        open={panelOpen}
        returnFocusRef={returnFocus}
        title={
          creating
            ? `${feminine ? 'Nueva' : 'Nuevo'} ${noun}`
            : editing
              ? `Editar ${noun}`
              : (item?.name ?? `Ficha ${feminine ? 'de la' : 'del'} ${noun}`)
        }
      >
        {creating && (
          <RecordForm
            fields={fields}
            idPrefix={`${idPrefix}-form`}
            noun={noun}
            onCancel={closePanel}
            onDirtyChange={setDirty}
            onSubmit={save}
          />
        )}
        {!creating && fichaId !== null && detail.isPending && (
          <p className="text-ink-muted">Cargando ficha…</p>
        )}
        {!creating && item && editing && (
          <RecordForm
            fields={fields}
            idPrefix={`${idPrefix}-form`}
            noun={noun}
            onCancel={() => {
              setEditing(false)
              setDirty(false)
            }}
            onDirtyChange={setDirty}
            onReload={() => detail.refetch()}
            onSubmit={save}
            record={toValues(item, fields)}
          />
        )}
        {!creating && item && !editing && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm">
              {fields.map((field) => (
                <div key={field.name}>
                  <dt className="font-semibold text-ink-muted">
                    {field.label}
                  </dt>
                  <dd className="text-ink">
                    {String((item as never)[field.name] || '—')}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="font-semibold text-ink-muted">Estado</dt>
                <dd>
                  <StatusBadge
                    label={item.is_active ? 'Activo' : 'Inactivo'}
                    tone={item.is_active ? 'success' : 'neutral'}
                  />
                </dd>
              </div>
            </dl>
            {canManage && (
              <RowActions>
                <Button
                  onClick={() => setEditing(true)}
                  type="button"
                  variant="secondary"
                >
                  <PencilSimple aria-hidden="true" size={15} />
                  Editar
                </Button>
                {stateAction(item)}
              </RowActions>
            )}
            <p className="text-xs text-ink-muted">
              {`Use ${article} ${noun} desde el formulario de productos; ${article} inactiv${feminine ? 'a' : 'o'} conserva sus productos asociados.`}
            </p>
          </div>
        )}
      </Drawer>

      <StateChangeDialog
        activateText={`¿Reactivar «${change?.name ?? ''}»? Volverá a estar disponible para nuevos productos.`}
        change={change}
        deactivateText={config.deactivateText({
          id: change?.id ?? 0,
          name: change?.name ?? '',
          is_active: true,
          version: change?.version ?? 0,
          created_at: '',
          updated_at: '',
        })}
        noun={noun}
        onClose={() => setChange(null)}
        onConfirm={changeState}
      />
    </div>
  )
}

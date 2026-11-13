import { PencilSimple, Power, Tag } from '@phosphor-icons/react'
import { useRef, useState } from 'react'

import { useSession } from '@/features/auth/hooks'
import type { Page } from '@/shared/api/catalog-resource'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  ElevatedDataList,
  FormModal,
  PageHeader,
  RowActions,
  StatusBadge,
  useToast,
} from '@/shared/ui'

import { CatalogToolbar, NewRecordButton } from './CatalogToolbar'
import { useUrlFilters } from './filters'
import { ListStates } from './ListStates'
import { useReturnFocus } from './useReturnFocus'
import {
  RecordForm,
  type RecordFormHandle,
  type RecordValues,
  type TextFieldSpec,
} from './RecordForm'
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
  const [saveLabel, setSaveLabel] = useState(`Guardar ${noun}`)
  const formRef = useRef<RecordFormHandle>(null)
  const toast = useToast()

  const fichaId = filters.getNumber('ficha') ?? null
  const list = config.useList({
    search: filters.search || undefined,
    isActive: filters.isActive,
    page: filters.page,
  })
  const detail = config.useDetail(fichaId)
  const item = detail.data
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
      toast.success(
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
    toast.success(
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
    toast.success(
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

  const panelOpen = creating || editing
  const returnFocus = useReturnFocus(panelOpen)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Tag />}
        actions={
          canManage && (
            <NewRecordButton
              label={`${feminine ? 'Nueva' : 'Nuevo'} ${noun}`}
              onClick={() => {
                setSaveLabel(`Guardar ${noun}`)
                setCreating(true)
              }}
            />
          )
        }
        description={config.description}
        title={config.title}
      />

      <ListStates
        toolbar={
          <CatalogToolbar
            filters={filters}
            idPrefix={idPrefix}
            label={`Barra de herramientas de ${config.nounPlural}`}
            searchLabel={`Buscar ${noun}`}
            searchPlaceholder="Buscar por nombre…"
            statusLabels={{
              active: feminine ? 'Activas' : 'Activos',
              inactive: feminine ? 'Inactivas' : 'Inactivos',
            }}
          />
        }
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
                      setSaveLabel('Guardar cambios')
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
              if (canManage) {
                setSaveLabel('Guardar cambios')
                setEditing(true)
                filters.set({ ficha: row.id })
              }
            }}
            rows={rows}
          />
        )}
      </ListStates>

      <FormModal
        description={
          creating
            ? `Complete los datos ${feminine ? 'de la nueva' : 'del nuevo'} ${noun}.`
            : `Modifique los datos ${feminine ? 'de la' : 'del'} ${noun}.`
        }
        dirty={dirty}
        onClose={closePanel}
        onSave={() => formRef.current?.submit() ?? false}
        open={panelOpen}
        returnFocusRef={returnFocus}
        saveLabel={saveLabel}
        title={
          creating
            ? `${feminine ? 'Nueva' : 'Nuevo'} ${noun}`
            : `Editar ${noun}`
        }
      >
        {creating && (
          <RecordForm
            embedded
            fields={fields}
            idPrefix={`${idPrefix}-form`}
            noun={noun}
            onDirtyChange={setDirty}
            onSubmitLabelChange={setSaveLabel}
            onSubmit={save}
            ref={formRef}
          />
        )}
        {!creating && editing && detail.isPending && (
          <p className="text-ink-muted">Cargando ficha…</p>
        )}
        {!creating && item && editing && (
          <RecordForm
            embedded
            fields={fields}
            idPrefix={`${idPrefix}-form`}
            noun={noun}
            onDirtyChange={setDirty}
            onReload={() => detail.refetch()}
            onSubmitLabelChange={setSaveLabel}
            onSubmit={save}
            ref={formRef}
            record={toValues(item, fields)}
          />
        )}
      </FormModal>

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

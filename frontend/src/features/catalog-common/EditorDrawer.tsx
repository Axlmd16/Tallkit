import { useState, type ReactNode } from 'react'

import { useIntentTracker } from '@/shared/api/idempotency'
import { Drawer } from '@/shared/ui'

import { useReturnFocus } from './useReturnFocus'

export interface EditorRecord {
  id: number
  version: number
  name: string
}

export interface EditorFormProps<T, D> {
  record: T | undefined
  onSubmit: (data: D) => Promise<void>
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onReload: () => void
}

/**
 * Panel de alta/edición con clave de idempotencia por intención: reintenta con la
 * misma clave tras un resultado incierto y usa una nueva si el borrador cambia.
 */
export function EditorDrawer<T extends EditorRecord, D extends object>({
  mode,
  noun,
  feminine = false,
  useDetail,
  useMutations,
  renderForm,
  onClose,
  onSaved,
}: {
  /** `'new'` para alta, un registro para editarlo o `null` cerrado. */
  mode: 'new' | T | null
  noun: string
  feminine?: boolean
  useDetail: (id: number | null) => {
    data?: T | undefined
    refetch: () => unknown
  }
  useMutations: () => {
    create: { mutateAsync: (v: { data: object; key: string }) => Promise<T> }
    update: {
      mutateAsync: (v: { id: number; data: object; key: string }) => Promise<T>
    }
  }
  renderForm: (props: EditorFormProps<T, D>) => ReactNode
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const tracker = useIntentTracker()
  const mutations = useMutations()
  const [dirty, setDirty] = useState(false)
  const returnFocus = useReturnFocus(mode !== null)
  const editing = mode !== null && mode !== 'new' ? mode : null
  const detail = useDetail(editing?.id ?? null)
  const record =
    editing && detail.data && detail.data.version >= editing.version
      ? detail.data
      : (editing ?? undefined)
  const label = `${noun[0]!.toUpperCase()}${noun.slice(1)}`

  function close() {
    setDirty(false)
    onClose()
  }

  async function save(data: D) {
    if (!record) {
      const saved = await tracker.run({ op: 'create', data }, (key) =>
        mutations.create.mutateAsync({ data, key }),
      )
      onSaved(`${label} «${saved.name}» ${feminine ? 'creada' : 'creado'}.`)
      close()
      return
    }
    if (Object.keys(data).length === 0) {
      close()
      return
    }
    const body = { ...data, expected_version: record.version }
    const saved = await tracker.run(
      { op: 'update', id: record.id, body },
      (key) => mutations.update.mutateAsync({ id: record.id, data: body, key }),
    )
    onSaved(
      `${label} «${saved.name}» ${feminine ? 'actualizada' : 'actualizado'}.`,
    )
    close()
  }

  return (
    <Drawer
      description={
        record
          ? `Modifique los datos ${feminine ? 'de la' : 'del'} ${noun}. Solo se envían los campos cambiados.`
          : `Complete los datos ${feminine ? 'de la nueva' : 'del nuevo'} ${noun}.`
      }
      hasUnsavedChanges={dirty}
      onClose={close}
      open={mode !== null}
      returnFocusRef={returnFocus}
      title={
        record ? `Editar ${noun}` : `${feminine ? 'Nueva' : 'Nuevo'} ${noun}`
      }
    >
      {mode !== null &&
        renderForm({
          record,
          onSubmit: save,
          onCancel: close,
          onDirtyChange: setDirty,
          onReload: () => detail.refetch(),
        })}
    </Drawer>
  )
}

import { useRef, useState } from 'react'

import { useIntentTracker } from '@/shared/api/idempotency'
import { FormModal } from '@/shared/ui'

import { useReturnFocus } from '../catalog-common/useReturnFocus'
import { useService, useServiceMutations } from './hooks'
import {
  ServiceForm,
  type ServiceFormHandle,
} from './ServiceForm'
import type { Service, ServiceInput } from './types'

export function ServiceEditorModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: 'new' | Service | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const tracker = useIntentTracker()
  const mutations = useServiceMutations()
  const [dirty, setDirty] = useState(false)
  const [saveLabel, setSaveLabel] = useState('Guardar servicio')
  const formRef = useRef<ServiceFormHandle>(null)
  const returnFocus = useReturnFocus(mode !== null)
  const editing = mode !== null && mode !== 'new' ? mode : null
  const detail = useService(editing?.id ?? null)
  const record =
    editing && detail.data && detail.data.version >= editing.version
      ? detail.data
      : (editing ?? undefined)

  function close() {
    setDirty(false)
    onClose()
  }

  async function save(data: Partial<ServiceInput>) {
    if (!record) {
      const saved = await tracker.run({ op: 'create', data }, (key) =>
        mutations.create.mutateAsync({ data, key }),
      )
      onSaved(`Servicio «${saved.name}» creado.`)
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
    onSaved(`Servicio «${saved.name}» actualizado.`)
    close()
  }

  return (
    <FormModal
      description={
        record
          ? 'Modifique los datos del servicio. Solo se envían los campos cambiados.'
          : 'Complete los datos del nuevo servicio.'
      }
      dirty={dirty}
      onClose={close}
      onSave={() => formRef.current?.submit() ?? false}
      open={mode !== null}
      returnFocusRef={returnFocus}
      saveLabel={saveLabel}
      title={record ? 'Editar servicio' : 'Nuevo servicio'}
    >
      {mode !== null && (
        <ServiceForm
          embedded
          key={record ? `edit-${record.id}` : 'new'}
          onDirtyChange={setDirty}
          onReload={() => detail.refetch()}
          onSubmit={save}
          onSubmitLabelChange={setSaveLabel}
          ref={formRef}
          service={record}
        />
      )}
    </FormModal>
  )
}

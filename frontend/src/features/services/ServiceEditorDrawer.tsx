import { EditorDrawer } from '@/features/catalog-common/EditorDrawer'

import { useService, useServiceMutations } from './hooks'
import { ServiceForm } from './ServiceForm'
import type { Service, ServiceInput } from './types'

export function ServiceEditorDrawer({
  mode,
  onClose,
  onSaved,
}: {
  mode: 'new' | Service | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  return (
    <EditorDrawer<Service, Partial<ServiceInput>>
      mode={mode}
      noun="servicio"
      onClose={onClose}
      onSaved={onSaved}
      renderForm={({ record, ...form }) => (
        <ServiceForm
          key={record ? `edit-${record.id}` : 'new'}
          onCancel={form.onCancel}
          onDirtyChange={form.onDirtyChange}
          onReload={form.onReload}
          onSubmit={form.onSubmit}
          service={record}
        />
      )}
      useDetail={useService}
      useMutations={useServiceMutations}
    />
  )
}

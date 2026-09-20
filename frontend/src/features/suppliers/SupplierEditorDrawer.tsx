import { EditorDrawer } from '@/features/catalog-common/EditorDrawer'

import { useSupplier, useSupplierMutations } from './hooks'
import { SupplierForm } from './SupplierForm'
import type { Supplier, SupplierInput } from './types'

export function SupplierEditorDrawer({
  mode,
  onClose,
  onSaved,
}: {
  mode: 'new' | Supplier | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  return (
    <EditorDrawer<Supplier, Partial<SupplierInput>>
      mode={mode}
      noun="proveedor"
      onClose={onClose}
      onSaved={onSaved}
      renderForm={({ record, ...form }) => (
        <SupplierForm
          key={record ? `edit-${record.id}` : 'new'}
          onCancel={form.onCancel}
          onDirtyChange={form.onDirtyChange}
          onReload={form.onReload}
          onSubmit={form.onSubmit}
          supplier={record}
        />
      )}
      useDetail={useSupplier}
      useMutations={useSupplierMutations}
      width="medium"
    />
  )
}

import { EditorDrawer } from '@/features/catalog-common/EditorDrawer'

import { useProduct, useProductMutations } from './hooks'
import { ProductForm } from './ProductForm'
import type { Product, ProductInput } from './types'

/** Panel de alta/edición de producto. */
export function ProductEditorDrawer({
  mode,
  onClose,
  onSaved,
}: {
  mode: 'new' | Product | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  return (
    <EditorDrawer<Product, Partial<ProductInput>>
      mode={mode}
      noun="producto"
      onClose={onClose}
      onSaved={onSaved}
      renderForm={({ record, ...form }) => (
        <ProductForm
          key={record ? `edit-${record.id}` : 'new'}
          onCancel={form.onCancel}
          onDirtyChange={form.onDirtyChange}
          onReload={form.onReload}
          onSubmit={form.onSubmit}
          product={record}
        />
      )}
      useDetail={useProduct}
      useMutations={useProductMutations}
    />
  )
}

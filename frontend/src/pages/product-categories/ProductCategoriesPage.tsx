import { AuxiliaryCatalogPage } from '@/features/catalog-common/AuxiliaryCatalogPage'
import {
  useProductCategoryDetail,
  useProductCategoryList,
  useProductCategoryMutations,
} from '@/features/product-categories/hooks'
import type { ProductCategory } from '@/features/product-categories/types'

export function ProductCategoriesPage() {
  return (
    <AuxiliaryCatalogPage<ProductCategory>
      deactivateText={(item) =>
        `¿Desactivar la categoría «${item.name}»? Solo es posible si no tiene productos activos; los productos inactivos conservan su categoría.`
      }
      description="Categorías planas para clasificar productos. Una categoría con productos activos no se puede desactivar."
      extraField={{ name: 'description', label: 'Descripción' }}
      feminine
      fields={[
        { name: 'name', label: 'Nombre', maxLength: 255, required: true },
        {
          name: 'description',
          label: 'Descripción',
          maxLength: 2000,
          multiline: true,
        },
      ]}
      idPrefix="category"
      noun="categoría"
      nounPlural="categorías"
      title="Categorías de productos"
      useDetail={useProductCategoryDetail}
      useList={useProductCategoryList}
      useMutations={useProductCategoryMutations}
    />
  )
}

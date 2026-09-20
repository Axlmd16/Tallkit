import { AuxiliaryCatalogPage } from '@/features/catalog-common/AuxiliaryCatalogPage'
import {
  useProductBrandDetail,
  useProductBrandList,
  useProductBrandMutations,
} from '@/features/product-brands/hooks'
import type { ProductBrand } from '@/features/product-brands/types'

export function ProductBrandsPage() {
  return (
    <AuxiliaryCatalogPage<ProductBrand>
      deactivateText={(item) =>
        `¿Desactivar la marca «${item.name}»? Los productos asociados la conservan, pero no podrá elegirse en productos nuevos.`
      }
      description="Marcas de los productos. Son independientes de las marcas de vehículo."
      feminine
      fields={[
        { name: 'name', label: 'Nombre', maxLength: 255, required: true },
      ]}
      idPrefix="brand"
      noun="marca de producto"
      nounPlural="marcas de producto"
      title="Marcas de producto"
      useDetail={useProductBrandDetail}
      useList={useProductBrandList}
      useMutations={useProductBrandMutations}
    />
  )
}

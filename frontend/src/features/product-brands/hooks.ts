import { createCatalogHooks } from '@/shared/api/catalog-hooks'

import { productBrandsApi } from './api'
import type { ProductBrand } from './types'

/** Categorías, unidades y marcas alimentan filtros y formularios de productos. */
const hooks = createCatalogHooks<ProductBrand>({
  key: 'product-brands',
  api: productBrandsApi,
  related: ['products'],
})

export const useProductBrandList = hooks.useList
export const useProductBrandDetail = hooks.useDetail
export const useProductBrandMutations = hooks.useMutations

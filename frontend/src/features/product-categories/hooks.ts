import { createCatalogHooks } from '@/shared/api/catalog-hooks'

import { productCategoriesApi } from './api'
import type { ProductCategory } from './types'

/** Categorías, unidades y marcas alimentan filtros y formularios de productos. */
const hooks = createCatalogHooks<ProductCategory>({
  key: 'product-categories',
  api: productCategoriesApi,
  related: ['products'],
})

export const useProductCategoryList = hooks.useList
export const useProductCategoryDetail = hooks.useDetail
export const useProductCategoryMutations = hooks.useMutations

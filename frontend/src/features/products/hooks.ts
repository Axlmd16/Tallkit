import { useQuery } from '@tanstack/react-query'

import { createCatalogHooks } from '@/shared/api/catalog-hooks'

import { productsApi, type TaxOptionFilters } from './api'
import type { Product, ProductFilters } from './types'

const hooks = createCatalogHooks<Product, ProductFilters>({
  key: 'products',
  api: productsApi,
})

export const useProducts = hooks.useList
export const useProduct = hooks.useDetail
export const useProductMutations = hooks.useMutations

export function useProductTaxOptions(
  filters: TaxOptionFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['products', 'tax-options', filters],
    queryFn: () => productsApi.taxOptions(filters),
    enabled,
    refetchOnWindowFocus: true,
  })
}

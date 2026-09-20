import { useQuery } from '@tanstack/react-query'

import type { TaxOptionFilters } from '@/features/products/api'
import { createCatalogHooks } from '@/shared/api/catalog-hooks'

import { servicesApi } from './api'
import type { Service } from './types'

const hooks = createCatalogHooks<Service>({
  key: 'services',
  api: servicesApi,
})

export const useServices = hooks.useList
export const useService = hooks.useDetail
export const useServiceMutations = hooks.useMutations

export function useServiceTaxOptions(
  filters: TaxOptionFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['services', 'tax-options', filters],
    queryFn: () => servicesApi.taxOptions(filters),
    enabled,
    refetchOnWindowFocus: true,
  })
}

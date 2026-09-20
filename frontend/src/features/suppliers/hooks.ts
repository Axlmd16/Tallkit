import { useQuery } from '@tanstack/react-query'

import { createCatalogHooks } from '@/shared/api/catalog-hooks'

import { suppliersApi } from './api'
import type { Supplier } from './types'

const hooks = createCatalogHooks<Supplier>({
  key: 'suppliers',
  api: suppliersApi,
})

export const useSuppliers = hooks.useList
export const useSupplier = hooks.useDetail
export const useSupplierMutations = hooks.useMutations

/** Advertencia de nombres coincidentes; solo consulta con al menos dos caracteres. */
export function useSupplierNameMatches(name: string, excludeId?: number) {
  const trimmed = name.trim()
  return useQuery({
    queryKey: ['suppliers', 'matches', trimmed, excludeId ?? null],
    queryFn: () => suppliersApi.matches(trimmed, excludeId),
    enabled: trimmed.length >= 2,
  })
}

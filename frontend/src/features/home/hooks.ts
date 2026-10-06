import { useQuery } from '@tanstack/react-query'

import { homeApi } from './api'

export const homeKeys = {
  root: ['home'] as const,
  pending: ['home', 'pending'] as const,
  receivables: ['home', 'receivables'] as const,
  collections: ['home', 'collections'] as const,
}

/**
 * Tres consultas independientes, una por bloque: si una falla, las otras siguen. Se consideran
 * viejas de inmediato para que cada visita al inicio las pida de nuevo; no hay sondeo.
 */
const fresh = { staleTime: 0 } as const

export function useHomePending(enabled = true) {
  return useQuery({
    ...fresh,
    enabled,
    queryFn: () => homeApi.pending(),
    queryKey: homeKeys.pending,
  })
}

export function useHomeReceivables(enabled = true) {
  return useQuery({
    ...fresh,
    enabled,
    queryFn: () => homeApi.receivables(),
    queryKey: homeKeys.receivables,
  })
}

export function useHomeCollections(enabled = true) {
  return useQuery({
    ...fresh,
    enabled,
    queryFn: () => homeApi.collections(),
    queryKey: homeKeys.collections,
  })
}

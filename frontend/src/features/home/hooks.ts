import { useQuery } from '@tanstack/react-query'

import { homeApi } from './api'

export const homeKeys = {
  root: ['home'] as const,
  pending: ['home', 'pending'] as const,
  receivables: ['home', 'receivables'] as const,
  collections: ['home', 'collections'] as const,
  unbilled: ['home', 'unbilled'] as const,
}

/**
 * Tres consultas independientes, una por bloque: si una falla, las otras siguen. Se consideran
 * viejas de inmediato y no se conservan al salir del inicio: cada visita las pide de nuevo y
 * muestra la carga, nunca los valores de la visita anterior como si fueran actuales. No hay
 * sondeo.
 */
export const fresh = { gcTime: 0, staleTime: 0 } as const

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


export function useHomeUnbilled(enabled = true) {
  return useQuery({
    ...fresh,
    enabled,
    queryFn: () => homeApi.unbilled(),
    queryKey: homeKeys.unbilled,
  })
}

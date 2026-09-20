import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { invalidateAfterPurchaseMutation } from '@/features/purchases/hooks'

import { inventoryApi } from './api'
import type { KardexFilters, OperationInput, StockFilters } from './types'

export const inventoryKeys = {
  root: ['inventory'] as const,
  stock: (filters: StockFilters) => ['inventory', 'stock', filters] as const,
  item: (id: number | null) => ['inventory', 'item', id] as const,
  kardex: (id: number | null, filters: KardexFilters) =>
    ['inventory', 'kardex', id, filters] as const,
  operation: (id: number | null) => ['inventory', 'operation', id] as const,
}

export function useStock(filters: StockFilters = {}) {
  return useQuery({
    queryKey: inventoryKeys.stock(filters),
    queryFn: () => inventoryApi.stock(filters),
    refetchOnWindowFocus: true,
  })
}

export function useStockItem(productId: number | null, enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.item(productId),
    queryFn: () => inventoryApi.item(productId as number),
    enabled: enabled && typeof productId === 'number' && productId > 0,
  })
}

/**
 * El Kardex se lee contra un corte: `cutToken` solo cambia por una acción
 * explícita del usuario. No se refresca al recuperar el foco para no mezclar
 * filas antiguas con resúmenes nuevos.
 */
export function useKardex(productId: number | null, filters: KardexFilters) {
  return useQuery({
    queryKey: inventoryKeys.kardex(productId, filters),
    queryFn: () => inventoryApi.kardex(productId as number, filters),
    enabled: typeof productId === 'number' && productId > 0,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: false,
  })
}

export function useOperation(id: number | null) {
  return useQuery({
    queryKey: inventoryKeys.operation(id),
    queryFn: () => inventoryApi.operation(id as number),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useOperationMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfterPurchaseMutation(queryClient)
  const base = { retry: false, onSuccess } as const
  return {
    create: useMutation({
      ...base,
      mutationFn: ({ data, key }: { data: OperationInput; key: string }) =>
        inventoryApi.create(data, key),
    }),
    confirm: useMutation({
      ...base,
      mutationFn: (v: {
        id: number
        expectedVersion: number
        reviewToken: string
        key: string
      }) =>
        inventoryApi.confirm(
          v.id,
          { expectedVersion: v.expectedVersion, reviewToken: v.reviewToken },
          v.key,
        ),
    }),
    reverse: useMutation({
      ...base,
      mutationFn: (v: {
        id: number
        expectedVersion: number
        reviewToken: string
        reason: string
        key: string
      }) =>
        inventoryApi.reverse(
          v.id,
          {
            expectedVersion: v.expectedVersion,
            reviewToken: v.reviewToken,
            reason: v.reason,
          },
          v.key,
        ),
    }),
    preview: useMutation({
      retry: false,
      mutationFn: (id: number) => inventoryApi.preview(id),
    }),
    reversePreview: useMutation({
      retry: false,
      mutationFn: (id: number) => inventoryApi.reversePreview(id),
    }),
  }
}

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { purchasesApi } from './api'
import type { EntryInput, PurchaseFilters } from './types'

export const purchaseKeys = {
  root: ['purchases'] as const,
  list: (filters: PurchaseFilters) => ['purchases', 'list', filters] as const,
  detail: (id: number | null) => ['purchases', 'detail', id] as const,
  suppliers: (search: string, page: number) =>
    ['purchases', 'supplier-options', search, page] as const,
}

/**
 * Tras una mutación propia se invalidan entradas, existencias, fichas y Kardex.
 * Los Kardex en caché se eliminan: su corte ya no representa el estado vigente y
 * la siguiente lectura debe solicitar un corte nuevo.
 */
export async function invalidateAfterPurchaseMutation(
  queryClient: QueryClient,
): Promise<void> {
  queryClient.removeQueries({ queryKey: ['inventory', 'kardex'] })
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: purchaseKeys.root }),
    queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  ])
}

export function usePurchases(filters: PurchaseFilters = {}) {
  return useQuery({
    queryKey: purchaseKeys.list(filters),
    queryFn: () => purchasesApi.list(filters),
    refetchOnWindowFocus: true,
  })
}

export function usePurchase(id: number | null) {
  return useQuery({
    queryKey: purchaseKeys.detail(id),
    queryFn: () => purchasesApi.get(id as number),
    enabled: typeof id === 'number' && id > 0,
    refetchOnWindowFocus: true,
  })
}

/**
 * Mutaciones idempotentes: nunca reintentan por sí solas (`retry: false`); tras un
 * resultado incierto el llamador reenvía el mismo payload con la misma clave.
 */
export function usePurchaseMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfterPurchaseMutation(queryClient)
  const base = { retry: false, onSuccess } as const
  return {
    register: useMutation({
      ...base,
      mutationFn: ({ input, key }: { input: EntryInput; key: string }) =>
        purchasesApi.registerEntry(input, key),
    }),
    void: useMutation({
      ...base,
      mutationFn: (v: {
        id: number
        expectedVersion: number
        reviewToken: string
        reason: string
        key: string
      }) =>
        purchasesApi.void(
          v.id,
          {
            expectedVersion: v.expectedVersion,
            reviewToken: v.reviewToken,
            reason: v.reason,
          },
          v.key,
        ),
    }),
    review: useMutation({
      retry: false,
      mutationFn: (input: EntryInput) => purchasesApi.reviewEntry(input),
    }),
    voidPreview: useMutation({
      retry: false,
      mutationFn: (id: number) => purchasesApi.voidPreview(id),
    }),
  }
}

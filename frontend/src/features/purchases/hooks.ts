import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { purchasesApi } from './api'
import type { PurchaseFilters, PurchaseInput } from './types'

export const purchaseKeys = {
  root: ['purchases'] as const,
  list: (filters: PurchaseFilters) => ['purchases', 'list', filters] as const,
  detail: (id: number | null) => ['purchases', 'detail', id] as const,
  taxOptions: (date: string | null, search: string) =>
    ['purchases', 'tax-options', date, search] as const,
}

/**
 * Tras una mutación propia se invalidan compras, existencias, fichas y Kardex.
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

export function usePurchaseTaxOptions(date: string | null, search = '') {
  return useQuery({
    queryKey: purchaseKeys.taxOptions(date, search),
    queryFn: () => purchasesApi.taxOptions(date as string, search),
    enabled: Boolean(date),
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
    create: useMutation({
      ...base,
      mutationFn: ({ data, key }: { data: PurchaseInput; key: string }) =>
        purchasesApi.create(data, key),
    }),
    update: useMutation({
      ...base,
      mutationFn: (v: {
        id: number
        data: Partial<PurchaseInput>
        expectedVersion: number
        key: string
      }) => purchasesApi.update(v.id, v.data, v.expectedVersion, v.key),
    }),
    confirm: useMutation({
      ...base,
      mutationFn: (v: {
        id: number
        expectedVersion: number
        reviewToken: string
        acknowledgedMatches?: number[]
        key: string
      }) =>
        purchasesApi.confirm(
          v.id,
          {
            expectedVersion: v.expectedVersion,
            reviewToken: v.reviewToken,
            acknowledgedMatches: v.acknowledgedMatches,
          },
          v.key,
        ),
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
    replacement: useMutation({
      ...base,
      mutationFn: (v: { id: number; key: string }) =>
        purchasesApi.replacement(v.id, v.key),
    }),
    preview: useMutation({
      retry: false,
      mutationFn: (id: number) => purchasesApi.preview(id),
    }),
    voidPreview: useMutation({
      retry: false,
      mutationFn: (id: number) => purchasesApi.voidPreview(id),
    }),
  }
}

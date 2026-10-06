import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { salesApi } from './api'
import type { SaleFilters, SaleInput } from './types'

export const saleKeys = {
  root: ['sales'] as const,
  list: (filters: SaleFilters) => ['sales', 'list', filters] as const,
  receivables: (filters: SaleFilters) =>
    ['sales', 'receivables', filters] as const,
  detail: (id: number | null) => ['sales', 'detail', id] as const,
  document: (id: number | null) => ['sales', 'document', id] as const,
  operation: (id: string | null) => ['sales', 'operation', id] as const,
  pendingWithholdings: (page: number) =>
    ['sales', 'withholdings', 'pending', page] as const,
  customers: (term: string, page: number) =>
    ['sales', 'customers', term, page] as const,
  products: (term: string, page: number) =>
    ['sales', 'products', term, page] as const,
}

/**
 * Tras una mutación propia se invalidan ventas, listas y cuentas por cobrar. Un cambio
 * físico (confirmar, devolver o anular) invalida además inventario y elimina los cortes
 * de Kardex en caché: su corte ya no representa el estado vigente.
 */
export async function invalidateAfterSaleMutation(
  queryClient: QueryClient,
  options: { physical?: boolean } = {},
): Promise<void> {
  if (options.physical) {
    queryClient.removeQueries({ queryKey: ['inventory', 'kardex'] })
  }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: saleKeys.root }),
    // Una venta vinculada cambia repuestos y resumen económico de su orden.
    queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
    ...(options.physical
      ? [queryClient.invalidateQueries({ queryKey: ['inventory'] })]
      : []),
  ])
}

export function useSales(filters: SaleFilters = {}) {
  return useQuery({
    queryKey: saleKeys.list(filters),
    queryFn: () => salesApi.list(filters),
    refetchOnWindowFocus: true,
  })
}

export function useReceivables(filters: SaleFilters = {}) {
  return useQuery({
    queryKey: saleKeys.receivables(filters),
    queryFn: () => salesApi.receivables(filters),
    refetchOnWindowFocus: true,
  })
}

export function usePendingWithholdings(page = 1, enabled = true) {
  return useQuery({
    queryKey: saleKeys.pendingWithholdings(page),
    queryFn: () => salesApi.pendingWithholdings({ page }),
    enabled,
    refetchOnWindowFocus: true,
  })
}

export function useSale(id: number | null) {
  return useQuery({
    queryKey: saleKeys.detail(id),
    queryFn: () => salesApi.get(id as number),
    enabled: typeof id === 'number' && id > 0,
    refetchOnWindowFocus: true,
  })
}

export function useSaleDocument(id: number | null) {
  return useQuery({
    queryKey: saleKeys.document(id),
    queryFn: () => salesApi.document(id as number),
    enabled: typeof id === 'number' && id > 0,
  })
}

/** Estado de un hecho ya registrado por su UUID; 404 significa «sin resultado registrado». */
export function useOperationStatus(operationId: string | null) {
  return useQuery({
    queryKey: saleKeys.operation(operationId),
    queryFn: () => salesApi.operation(operationId as string),
    enabled: Boolean(operationId),
    retry: false,
    staleTime: 0,
  })
}

export function useCustomerOptions(term: string, page: number) {
  return useQuery({
    queryKey: saleKeys.customers(term, page),
    queryFn: () => salesApi.customerOptions(term, page),
  })
}

export function useProductOptions(term: string, page: number) {
  return useQuery({
    queryKey: saleKeys.products(term, page),
    queryFn: () => salesApi.productOptions(term, page),
  })
}

/**
 * Mutaciones idempotentes: nunca reintentan por sí solas (`retry: false`). Tras un
 * resultado incierto el llamador reenvía el mismo payload con la misma clave y el mismo UUID.
 */
export function useSaleMutations() {
  const queryClient = useQueryClient()
  const cash = () => invalidateAfterSaleMutation(queryClient)
  const physical = () =>
    invalidateAfterSaleMutation(queryClient, { physical: true })
  return {
    create: useMutation({
      retry: false,
      onSuccess: cash,
      mutationFn: ({ data, key }: { data: SaleInput; key: string }) =>
        salesApi.create(data, key),
    }),
    update: useMutation({
      retry: false,
      onSuccess: cash,
      mutationFn: (v: {
        id: number
        data: Partial<SaleInput>
        expectedVersion: number
        key: string
      }) => salesApi.update(v.id, v.data, v.expectedVersion, v.key),
    }),
    confirm: useMutation({
      retry: false,
      onSuccess: physical,
      mutationFn: (v: {
        id: number
        expectedVersion: number
        reviewToken: string
        key: string
      }) =>
        salesApi.confirm(
          v.id,
          { expectedVersion: v.expectedVersion, reviewToken: v.reviewToken },
          v.key,
        ),
    }),
    registerPayment: useMutation({
      retry: false,
      onSuccess: cash,
      mutationFn: (
        v: Parameters<typeof salesApi.registerPayment>[1] & {
          id: number
          key: string
        },
      ) => salesApi.registerPayment(v.id, v, v.key),
    }),
    correctPayment: useMutation({
      retry: false,
      onSuccess: cash,
      mutationFn: (
        v: Parameters<typeof salesApi.correctPayment>[2] & {
          id: number
          paymentId: number
          key: string
        },
      ) => salesApi.correctPayment(v.id, v.paymentId, v, v.key),
    }),
    completeVoucher: useMutation({
      retry: false,
      onSuccess: cash,
      mutationFn: (
        v: Parameters<typeof salesApi.completeVoucher>[2] & {
          id: number
          withholdingId: number
          key: string
        },
      ) => salesApi.completeVoucher(v.id, v.withholdingId, v, v.key),
    }),
    correctVoucher: useMutation({
      retry: false,
      onSuccess: cash,
      mutationFn: (
        v: Parameters<typeof salesApi.correctVoucher>[2] & {
          id: number
          withholdingId: number
          key: string
        },
      ) => salesApi.correctVoucher(v.id, v.withholdingId, v, v.key),
    }),
    voidWithholding: useMutation({
      retry: false,
      onSuccess: cash,
      mutationFn: (v: {
        id: number
        withholdingId: number
        reason: string
        key: string
      }) =>
        salesApi.voidWithholding(
          v.id,
          v.withholdingId,
          { reason: v.reason },
          v.key,
        ),
    }),
    registerReturn: useMutation({
      retry: false,
      onSuccess: physical,
      mutationFn: (
        v: Parameters<typeof salesApi.registerReturn>[1] & {
          id: number
          key: string
        },
      ) => salesApi.registerReturn(v.id, v, v.key),
    }),
    registerRefund: useMutation({
      retry: false,
      onSuccess: cash,
      mutationFn: (
        v: Parameters<typeof salesApi.registerRefund>[1] & {
          id: number
          key: string
        },
      ) => salesApi.registerRefund(v.id, v, v.key),
    }),
    void: useMutation({
      retry: false,
      onSuccess: physical,
      mutationFn: (
        v: Parameters<typeof salesApi.void>[1] & { id: number; key: string },
      ) => salesApi.void(v.id, v, v.key),
    }),
    preview: useMutation({
      retry: false,
      mutationFn: (id: number) => salesApi.preview(id),
    }),
  }
}

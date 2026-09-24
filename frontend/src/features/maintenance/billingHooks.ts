import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import type { ComboboxResults } from '@/shared/ui'

import { maintenanceApi, type PaymentPartInput } from './api'
import { applyOrder, maintenanceKeys } from './hooks'
import type {
  ArtisanReceivableFilters,
  MaintenanceOrder,
  ServiceOperation,
} from './types'

export const billingKeys = {
  parts: (id: number) => ['maintenance', 'parts', id] as const,
  partProducts: (id: number, term: string, page: number) =>
    ['maintenance', 'part-products', id, term, page] as const,
  summary: (id: number) => ['maintenance', 'summary', id] as const,
  commercialView: (id: number) =>
    ['maintenance', 'commercial-view', id] as const,
  operation: (id: number | null) =>
    ['maintenance', 'service-operation', id] as const,
  operationDocument: (id: number | null) =>
    ['maintenance', 'service-operation-document', id] as const,
  voidPreview: (id: number) =>
    ['maintenance', 'service-operation-void-preview', id] as const,
  receivables: (filters: ArtisanReceivableFilters) =>
    ['maintenance', 'artisan-receivables', filters] as const,
}

/**
 * Un cambio de repuestos o documentos afecta la orden, sus ventas vinculadas, el inventario
 * (reservas) y las cuentas por cobrar; se invalidan juntos para no mostrar saldos viejos.
 */
async function invalidateBilling(queryClient: QueryClient): Promise<void> {
  queryClient.removeQueries({ queryKey: ['inventory', 'kardex'] })
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: maintenanceKeys.root }),
    queryClient.invalidateQueries({ queryKey: ['sales'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  ])
}

export function useOrderParts(id: number, enabled = true) {
  return useQuery({
    queryKey: billingKeys.parts(id),
    queryFn: () => maintenanceApi.parts(id),
    enabled,
  })
}

export function useEconomicSummary(id: number, enabled = true) {
  return useQuery({
    queryKey: billingKeys.summary(id),
    queryFn: () => maintenanceApi.economicSummary(id),
    enabled,
    refetchOnWindowFocus: true,
  })
}

export function useCommercialView(id: number | null) {
  return useQuery({
    queryKey: billingKeys.commercialView(id ?? 0),
    queryFn: () => maintenanceApi.commercialView(id as number),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useServiceOperation(id: number | null) {
  return useQuery({
    queryKey: billingKeys.operation(id),
    queryFn: () => maintenanceApi.serviceOperation(id as number),
    enabled: typeof id === 'number' && id > 0,
    refetchOnWindowFocus: true,
  })
}

export function useServiceOperationDocument(id: number | null) {
  return useQuery({
    queryKey: billingKeys.operationDocument(id),
    queryFn: () => maintenanceApi.serviceOperationDocument(id as number),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useVoidPreview(id: number, enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.voidPreview(id),
    queryFn: () => maintenanceApi.voidPreview(id),
    enabled,
  })
}

export function useArtisanReceivables(filters: ArtisanReceivableFilters) {
  return useQuery({
    queryKey: billingKeys.receivables(filters),
    queryFn: () => maintenanceApi.artisanReceivables(filters),
    refetchOnWindowFocus: true,
  })
}

/** Opciones de repuestos con existencia, reservado y disponible como ayuda informativa. */
export function usePartProductPicker(
  orderId: number,
  term: string,
  page: number,
): ComboboxResults {
  const query = useQuery({
    queryKey: billingKeys.partProducts(orderId, term, page),
    queryFn: () => maintenanceApi.partProductOptions(orderId, term, page),
  })
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((p) => ({
        id: p.id,
        label: `${p.code} · ${p.name}`,
        detail: `USD ${p.sale_price} · existencia ${p.quantity} · reservado ${p.reserved} · disponible ${p.available}`,
      })),
    },
  }
}

interface Versioned {
  id: number
  expectedVersion: number
  key: string
}

/** Mutaciones idempotentes: no reintentan solas; el llamador reenvía la misma intención. */
export function useBillingMutations() {
  const queryClient = useQueryClient()
  const onOrder = async (order: MaintenanceOrder) => {
    await applyOrder(queryClient, order)
    await invalidateBilling(queryClient)
  }
  const onOperation = async (operation: ServiceOperation) => {
    queryClient.setQueryData(billingKeys.operation(operation.id), operation)
    await invalidateBilling(queryClient)
  }
  return {
    addPart: useMutation({
      retry: false,
      onSuccess: onOrder,
      mutationFn: (v: Versioned & { productId: number; quantity: string }) =>
        maintenanceApi.addPart(
          v.id,
          { product_id: v.productId, quantity: v.quantity },
          v.expectedVersion,
          v.key,
        ),
    }),
    changePart: useMutation({
      retry: false,
      onSuccess: onOrder,
      mutationFn: (v: Versioned & { lineId: number; quantity: string }) =>
        maintenanceApi.changePart(
          v.id,
          v.lineId,
          v.quantity,
          v.expectedVersion,
          v.key,
        ),
    }),
    removePart: useMutation({
      retry: false,
      onSuccess: onOrder,
      mutationFn: (v: Versioned & { lineId: number }) =>
        maintenanceApi.removePart(v.id, v.lineId, v.expectedVersion, v.key),
    }),
    confirmServices: useMutation({
      retry: false,
      onSuccess: onOperation,
      mutationFn: (
        v: Versioned & { condition: string; reviewDigest: string },
      ) =>
        maintenanceApi.confirmServiceOperation(
          v.id,
          { condition: v.condition, review_digest: v.reviewDigest },
          v.expectedVersion,
          v.key,
        ),
    }),
    voidOperation: useMutation({
      retry: false,
      onSuccess: onOperation,
      mutationFn: (v: Versioned & { reason: string }) =>
        maintenanceApi.voidServiceOperation(
          v.id,
          v.reason,
          v.expectedVersion,
          v.key,
        ),
    }),
    pay: useMutation({
      retry: false,
      onSuccess: onOperation,
      mutationFn: (v: {
        id: number
        parts: PaymentPartInput[]
        factId: string
        key: string
      }) =>
        maintenanceApi.registerArtisanPayment(v.id, v.parts, v.factId, v.key),
    }),
    correctPayment: useMutation({
      retry: false,
      onSuccess: onOperation,
      mutationFn: (v: {
        id: number
        paymentId: number
        reason: string
        replacement?: { operation_id: string; parts: PaymentPartInput[] }
        factId: string
        key: string
      }) =>
        maintenanceApi.correctArtisanPayment(
          v.id,
          v.paymentId,
          v.replacement
            ? { reason: v.reason, replacement: v.replacement }
            : { reason: v.reason },
          v.factId,
          v.key,
        ),
    }),
  }
}

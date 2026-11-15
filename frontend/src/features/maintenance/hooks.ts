import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import type { ComboboxResults } from '@/shared/ui'

import { maintenanceApi, type LineInput } from './api'
import type { MaintenanceOrder, OrderFilters, OrderInput } from './types'

export const maintenanceKeys = {
  root: ['maintenance'] as const,
  list: (filters: OrderFilters) => ['maintenance', 'list', filters] as const,
  detail: (id: number | null) => ['maintenance', 'detail', id] as const,
  customers: (term: string, page: number) =>
    ['maintenance', 'customers', term, page] as const,
  vehicles: (customerId: number | null) =>
    ['maintenance', 'vehicles', customerId] as const,
  services: (term: string, page: number) =>
    ['maintenance', 'services', term, page] as const,
}

/** Guarda el detalle devuelto por el servidor e invalida listas e historiales. */
export async function applyOrder(
  queryClient: QueryClient,
  order: MaintenanceOrder,
): Promise<void> {
  queryClient.setQueryData(maintenanceKeys.detail(order.id), order)
  await queryClient.invalidateQueries({
    queryKey: maintenanceKeys.root,
    predicate: (query) => query.queryKey[1] !== 'detail',
  })
}

export function useMaintenanceOrders(
  filters: OrderFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: maintenanceKeys.list(filters),
    queryFn: () => maintenanceApi.list(filters),
    enabled,
    refetchOnWindowFocus: true,
  })
}

export function useMaintenanceOrder(id: number | null) {
  return useQuery({
    queryKey: maintenanceKeys.detail(id),
    queryFn: () => maintenanceApi.get(id as number),
    enabled: typeof id === 'number' && id > 0,
    refetchOnWindowFocus: true,
  })
}

export function useVehicleOptions(customerId: number | null) {
  return useQuery({
    queryKey: maintenanceKeys.vehicles(customerId),
    queryFn: () => maintenanceApi.vehicleOptions(customerId as number),
    enabled: typeof customerId === 'number' && customerId > 0,
  })
}

export function useCustomerPickerOptions(
  term: string,
  page: number,
): ComboboxResults {
  const query = useQuery({
    queryKey: maintenanceKeys.customers(term, page),
    queryFn: () => maintenanceApi.customerOptions(term, page),
  })
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((c) => ({
        id: c.id,
        label: c.name,
        detail: `${c.identification_type} ${c.identification} · ${c.phone}`,
      })),
    },
  }
}

export function useServicePickerOptions(
  term: string,
  page: number,
): ComboboxResults {
  const query = useQuery({
    queryKey: maintenanceKeys.services(term, page),
    queryFn: () => maintenanceApi.serviceOptions(term, page),
  })
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((s) => ({
        id: s.id,
        label: s.name,
        detail: `Precio referencial USD ${s.reference_price}`,
      })),
    },
  }
}

/** Servicios activos que coinciden con el texto, para el buscador de la ficha. */
export function useServiceSearch(term: string, enabled = true) {
  return useQuery({
    queryKey: maintenanceKeys.services(term, 1),
    queryFn: () => maintenanceApi.serviceOptions(term, 1),
    enabled: enabled && term !== '',
  })
}

interface Versioned {
  id: number
  expectedVersion: number
  key: string
}

/**
 * Mutaciones idempotentes: nunca reintentan por sí solas. Tras un resultado incierto el
 * llamador reenvía la misma intención con la misma clave.
 */
export function useMaintenanceMutations() {
  const queryClient = useQueryClient()
  const onSuccess = (order: MaintenanceOrder) => applyOrder(queryClient, order)
  return {
    create: useMutation({
      retry: false,
      onSuccess,
      mutationFn: ({ data, key }: { data: OrderInput; key: string }) =>
        maintenanceApi.create(data, key),
    }),
    update: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (v: Versioned & { data: Partial<OrderInput> }) =>
        maintenanceApi.update(v.id, v.data, v.expectedVersion, v.key),
    }),
    updateIntervention: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (
        v: Versioned & { data: { work_performed?: string; notes?: string } },
      ) =>
        maintenanceApi.updateIntervention(
          v.id,
          v.data,
          v.expectedVersion,
          v.key,
        ),
    }),
    addLine: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (v: Versioned & { data: LineInput }) =>
        maintenanceApi.addLine(v.id, v.data, v.expectedVersion, v.key),
    }),
    updateLine: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (
        v: Versioned & {
          lineId: number
          data: { quantity?: number; applied_price?: string }
        },
      ) =>
        maintenanceApi.updateLine(
          v.id,
          v.lineId,
          v.data,
          v.expectedVersion,
          v.key,
        ),
    }),
    removeLine: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (v: Versioned & { lineId: number }) =>
        maintenanceApi.removeLine(v.id, v.lineId, v.expectedVersion, v.key),
    }),
    finalize: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (v: Versioned) =>
        maintenanceApi.finalize(v.id, v.expectedVersion, v.key),
    }),
    reopen: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (v: Versioned & { reason: string }) =>
        maintenanceApi.reopen(v.id, v.reason, v.expectedVersion, v.key),
    }),
    uploadPhoto: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (v: {
        id: number
        file: File
        description: string
        key: string
      }) => maintenanceApi.uploadPhoto(v.id, v.file, v.description, v.key),
    }),
    removePhoto: useMutation({
      retry: false,
      onSuccess,
      mutationFn: (v: { id: number; photoId: number; key: string }) =>
        maintenanceApi.removePhoto(v.id, v.photoId, v.key),
    }),
  }
}

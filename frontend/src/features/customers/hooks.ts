import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { customersApi, type CustomersApi } from './api'
import type {
  CustomerFilters,
  CustomerMatchQuery,
  CustomerWrite,
} from './types'

export const customersQueryKey = ['customers'] as const

export function useCustomers(
  filters: CustomerFilters,
  api: CustomersApi = customersApi,
) {
  return useQuery({
    queryKey: [...customersQueryKey, filters],
    queryFn: () => api.list(filters),
  })
}

export function useCustomer(id: number, api: CustomersApi = customersApi) {
  return useQuery({
    queryKey: [...customersQueryKey, id],
    queryFn: () => api.get(id),
    enabled: Boolean(id),
  })
}

export function useCustomerMatches(
  query: CustomerMatchQuery,
  enabled: boolean = true,
  api: CustomersApi = customersApi,
) {
  return useQuery({
    queryKey: [...customersQueryKey, 'matches', query],
    queryFn: () => api.matches(query),
    enabled: enabled && Boolean(query.name?.trim() || query.phone?.trim()),
  })
}

export function useCustomerMutations(api: CustomersApi = customersApi) {
  const cache = useQueryClient()
  const refresh = () => cache.invalidateQueries({ queryKey: customersQueryKey })

  return {
    create: useMutation({
      mutationFn: (data: CustomerWrite) => api.create(data),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: CustomerWrite }) =>
        api.update(id, data),
      onSuccess: async (_, { id }) => {
        await refresh()
        await cache.invalidateQueries({ queryKey: [...customersQueryKey, id] })
        await cache.invalidateQueries({ queryKey: ['vehicles'] })
        await cache.invalidateQueries({ queryKey: ['customer-vehicles', id] })
      },
    }),
    activate: useMutation({
      mutationFn: ({
        id,
        expectedVersion,
      }: {
        id: number
        expectedVersion: number
      }) => api.activate(id, expectedVersion),
      onSuccess: async (_, { id }) => {
        await refresh()
        await cache.invalidateQueries({ queryKey: [...customersQueryKey, id] })
      },
    }),
    deactivate: useMutation({
      mutationFn: ({
        id,
        expectedVersion,
      }: {
        id: number
        expectedVersion: number
      }) => api.deactivate(id, expectedVersion),
      onSuccess: async (_, { id }) => {
        await refresh()
        await cache.invalidateQueries({ queryKey: [...customersQueryKey, id] })
      },
    }),
  }
}

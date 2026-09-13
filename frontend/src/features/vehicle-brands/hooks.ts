import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'

import { vehicleBrandsApi, type createVehicleBrandsApi } from './api'
import type {
  VehicleBrandCreate,
  VehicleBrandFilters,
  VehicleBrandPage,
  VehicleBrandSummary,
  VehicleBrandUpdate,
} from './types'

type VehicleBrandsApi = ReturnType<typeof createVehicleBrandsApi>

export function useVehicleBrands(
  filters: VehicleBrandFilters = {},
  api: VehicleBrandsApi = vehicleBrandsApi,
): UseQueryResult<VehicleBrandPage, Error> {
  return useQuery({
    queryKey: ['vehicle-brands', filters],
    queryFn: () => api.list(filters),
  })
}

export function useVehicleBrand(
  id: number | null,
  api: VehicleBrandsApi = vehicleBrandsApi,
): UseQueryResult<VehicleBrandSummary, Error> {
  return useQuery({
    queryKey: ['vehicle-brands', id],
    queryFn: () => api.get(id as number),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useVehicleBrandMutations(
  api: VehicleBrandsApi = vehicleBrandsApi,
) {
  const queryClient = useQueryClient()

  const createBrand = useMutation({
    mutationFn: (data: VehicleBrandCreate) => api.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-brands'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })

  const updateBrand = useMutation({
    mutationFn: ({ id, data }: { id: number; data: VehicleBrandUpdate }) =>
      api.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-brands'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })

  const activateBrand = useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: number
      expectedVersion: number
    }) => api.activate(id, expectedVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-brands'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })

  const deactivateBrand = useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: number
      expectedVersion: number
    }) => api.deactivate(id, expectedVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-brands'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })

  return {
    createBrand,
    updateBrand,
    activateBrand,
    deactivateBrand,
  }
}

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'

import { vehiclesApi, type createVehiclesApi } from './api'
import type {
  OwnershipPeriodPage,
  VehicleChangeOwnerInput,
  VehicleCreate,
  VehicleFilters,
  VehiclePage,
  VehicleSummary,
  VehicleUpdate,
} from './types'

type VehiclesApi = ReturnType<typeof createVehiclesApi>

export function useVehicles(
  filters: VehicleFilters = {},
  api: VehiclesApi = vehiclesApi,
): UseQueryResult<VehiclePage, Error> {
  return useQuery({
    queryKey: ['vehicles', filters],
    queryFn: () => api.list(filters),
  })
}

export function useVehicle(
  id: number | null,
  api: VehiclesApi = vehiclesApi,
): UseQueryResult<VehicleSummary, Error> {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: () => api.get(id as number),
    enabled: typeof id === 'number' && id > 0,
  })
}

export function useCustomerVehicles(
  customerId: number | null,
  page: number = 1,
  pageSize: number = 20,
  api: VehiclesApi = vehiclesApi,
): UseQueryResult<VehiclePage, Error> {
  return useQuery({
    queryKey: ['customer-vehicles', customerId, page, pageSize],
    queryFn: () => api.listByCustomer(customerId as number, page, pageSize),
    enabled: typeof customerId === 'number' && customerId > 0,
  })
}

export function useVehicleOwnershipPeriods(
  vehicleId: number | null,
  page: number = 1,
  pageSize: number = 20,
  api: VehiclesApi = vehiclesApi,
): UseQueryResult<OwnershipPeriodPage, Error> {
  return useQuery({
    queryKey: ['vehicle-ownership-periods', vehicleId, page, pageSize],
    queryFn: () =>
      api.listOwnershipPeriods(vehicleId as number, page, pageSize),
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
  })
}

export function useVehicleMutations(api: VehiclesApi = vehiclesApi) {
  const queryClient = useQueryClient()

  const createVehicle = useMutation({
    mutationFn: (data: VehicleCreate) => api.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      if (created.current_owner?.id) {
        queryClient.invalidateQueries({
          queryKey: ['customer-vehicles', created.current_owner.id],
        })
      }
    },
  })

  const updateVehicle = useMutation({
    mutationFn: ({ id, data }: { id: number; data: VehicleUpdate }) =>
      api.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', updated.id] })
      if (updated.current_owner?.id) {
        queryClient.invalidateQueries({
          queryKey: ['customer-vehicles', updated.current_owner.id],
        })
      }
    },
  })

  const changeOwner = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: VehicleChangeOwnerInput
      previousOwnerId?: number | undefined
    }) => api.changeOwner(id, data),
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', updated.id] })
      queryClient.invalidateQueries({
        queryKey: ['vehicle-ownership-periods', updated.id],
      })
      if (variables.previousOwnerId) {
        queryClient.invalidateQueries({
          queryKey: ['customer-vehicles', variables.previousOwnerId],
        })
      }
      if (updated.current_owner?.id) {
        queryClient.invalidateQueries({
          queryKey: ['customer-vehicles', updated.current_owner.id],
        })
      }
    },
  })

  const activateVehicle = useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: number
      expectedVersion: number
    }) => api.activate(id, expectedVersion),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', updated.id] })
      if (updated.current_owner?.id) {
        queryClient.invalidateQueries({
          queryKey: ['customer-vehicles', updated.current_owner.id],
        })
      }
    },
  })

  const deactivateVehicle = useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: number
      expectedVersion: number
    }) => api.deactivate(id, expectedVersion),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', updated.id] })
      if (updated.current_owner?.id) {
        queryClient.invalidateQueries({
          queryKey: ['customer-vehicles', updated.current_owner.id],
        })
      }
    },
  })

  return {
    createVehicle,
    updateVehicle,
    changeOwner,
    activateVehicle,
    deactivateVehicle,
  }
}

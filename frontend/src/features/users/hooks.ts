import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sessionQueryKey } from '@/features/auth/hooks'

import { usersApi, type UsersApi } from './api'
import type { UserFilters, UserWrite } from './types'

export const usersQueryKey = ['users'] as const

export function useUsers(filters: UserFilters, api: UsersApi = usersApi) {
  return useQuery({
    queryKey: [...usersQueryKey, filters],
    queryFn: () => api.list(filters),
  })
}

export function useRoles(api: UsersApi = usersApi) {
  return useQuery({ queryKey: ['roles'], queryFn: api.roles })
}

export function useUserMutations(api: UsersApi = usersApi) {
  const cache = useQueryClient()
  const refresh = () => cache.invalidateQueries({ queryKey: usersQueryKey })
  return {
    create: useMutation({
      mutationFn: (data: UserWrite) => api.create(data),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: UserWrite }) =>
        api.update(id, data),
      onSuccess: async () => {
        await refresh()
        await cache.invalidateQueries({ queryKey: sessionQueryKey })
      },
    }),
    activate: useMutation({ mutationFn: api.activate, onSuccess: refresh }),
    deactivate: useMutation({ mutationFn: api.deactivate, onSuccess: refresh }),
    resetPassword: useMutation({
      mutationFn: ({ id, operationId }: { id: number; operationId: string }) =>
        api.resetPassword(id, operationId),
    }),
  }
}

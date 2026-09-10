import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { authApi, type AuthApi } from './api'
import { anonymousSession } from './types'

export const sessionQueryKey = ['session'] as const

export function useSession(api: AuthApi = authApi) {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: api.getSession,
    retry: false,
  })
}

export function useLogin(api: AuthApi = authApi) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string
      password: string
    }) => api.login(username, password),
    onSuccess: (session) => queryClient.setQueryData(sessionQueryKey, session),
  })
}

export function useLogout(api: AuthApi = authApi) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () =>
      queryClient.setQueryData(sessionQueryKey, anonymousSession),
  })
}

export function useChangePassword(api: AuthApi = authApi) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string
      newPassword: string
    }) => api.changePassword(currentPassword, newPassword),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  })
}

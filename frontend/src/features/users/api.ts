import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type {
  RoleDefinition,
  UserFilters,
  UserPage,
  UserSummary,
  UserWrite,
} from './types'

function query(filters: UserFilters): string {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.isActive !== undefined)
    params.set('is_active', String(filters.isActive))
  if (filters.role) params.set('role', filters.role)
  params.set('page', String(filters.page ?? 1))
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export function createUsersApi(client: ApiClient) {
  return {
    list: (filters: UserFilters) =>
      client.request<UserPage>(`/users/${query(filters)}`),
    roles: () => client.request<RoleDefinition[]>('/roles/'),
    create: (data: UserWrite) =>
      client.request<UserSummary>('/users/', { method: 'POST', body: data }),
    update: (id: number, data: UserWrite) =>
      client.request<UserSummary>(`/users/${id}/`, {
        method: 'PATCH',
        body: data,
      }),
    activate: (id: number) =>
      client.request<UserSummary>(`/users/${id}/activate/`, { method: 'POST' }),
    deactivate: (id: number) =>
      client.request<UserSummary>(`/users/${id}/deactivate/`, {
        method: 'POST',
      }),
    resetPassword: (id: number, operationId: string) =>
      client.request<{ temporary_password: string }>(
        `/users/${id}/reset-password/`,
        { method: 'POST', body: { operation_id: operationId } },
      ),
  }
}

export type UsersApi = ReturnType<typeof createUsersApi>
export const usersApi = createUsersApi(new ApiClient(environment.apiBaseUrl))

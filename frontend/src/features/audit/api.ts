import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type { AuditFilters, AuditPage } from './types'

function query(filters: AuditFilters) {
  const params = new URLSearchParams()
  const pairs: Array<[string, string | undefined]> = [
    ['user', filters.user],
    ['from', filters.from],
    ['to', filters.to],
    ['action', filters.action],
    ['target_type', filters.targetType],
    ['target_id', filters.targetId],
    ['result', filters.result],
    ['page', String(filters.page ?? 1)],
  ]
  pairs.forEach(([key, value]) => value && params.set(key, value))
  return params.toString()
}

export function createAuditApi(client: ApiClient) {
  return {
    list: (filters: AuditFilters) =>
      client.request<AuditPage>(`/audit/?${query(filters)}`),
  }
}

export type AuditApi = ReturnType<typeof createAuditApi>
export const auditApi = createAuditApi(new ApiClient(environment.apiBaseUrl))

import { useQuery } from '@tanstack/react-query'

import { auditApi, type AuditApi } from './api'
import type { AuditFilters } from './types'

export function useAudit(filters: AuditFilters, api: AuditApi = auditApi) {
  return useQuery({
    queryKey: ['audit', filters],
    queryFn: () => api.list(filters),
  })
}

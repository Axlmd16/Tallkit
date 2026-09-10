export interface AuditEvent {
  id: number
  actor: { id: number; username: string } | null
  action: string
  target_type: string
  target_id: string
  result: 'SUCCESS' | 'FAILURE' | 'DENIED'
  occurred_at: string
  reason: string | null
  request_id: string | null
  operation_id: string | null
  metadata: Record<string, unknown>
}

export interface AuditPage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: AuditEvent[]
}

export interface AuditFilters {
  user?: string | undefined
  from?: string | undefined
  to?: string | undefined
  action?: string | undefined
  targetType?: string | undefined
  targetId?: string | undefined
  result?: AuditEvent['result'] | undefined
  page?: number
}

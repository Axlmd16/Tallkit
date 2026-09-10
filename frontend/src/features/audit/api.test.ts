import { expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createAuditApi } from './api'

it('maps the supported audit filters without changing their timestamps', async () => {
  const request = vi.fn().mockResolvedValue({})
  const api = createAuditApi({ request } as unknown as ApiClient)
  await api.list({
    user: '4',
    from: '2026-09-01T00:00:00-05:00',
    result: 'SUCCESS',
    targetType: 'user',
  })

  expect(request).toHaveBeenCalledWith(
    '/audit/?user=4&from=2026-09-01T00%3A00%3A00-05%3A00&target_type=user&result=SUCCESS&page=1',
  )
})

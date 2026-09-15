import { describe, expect, it, vi } from 'vitest'
import { createWorkshopConfigApi } from '../api'
import { ApiClient } from '@/shared/api/client'

vi.mock('@/shared/api/client', () => {
  return {
    ApiClient: vi.fn().mockImplementation(function (this: {
      request: ReturnType<typeof vi.fn>
    }) {
      this.request = vi.fn()
    }),
  }
})

describe('workshopConfigApi', () => {
  it('getStatus calls correct endpoint', async () => {
    const mockClient = new ApiClient('/test')
    vi.mocked(mockClient.request).mockResolvedValueOnce({
      is_initialized: true,
    })

    const api = createWorkshopConfigApi(mockClient)
    const res = await api.getStatus()

    expect(mockClient.request).toHaveBeenCalledWith(
      '/workshop-configuration/status/',
    )
    expect(res.is_initialized).toBe(true)
  })

  it('initialize sends idempotency key', async () => {
    const mockClient = new ApiClient('/test')
    vi.mocked(mockClient.request).mockResolvedValueOnce({ installation_id: 1 })

    const api = createWorkshopConfigApi(mockClient)
    const payload = {
      commercial_ruc: '0991234567001',
      commercial_legal_name: 'C',
      artisanal_ruc: '1791234567001',
      artisanal_legal_name: 'A',
      warehouse_name: 'W',
    }
    await api.initialize(payload, 'test-key')
    expect(mockClient.request).toHaveBeenCalledWith(
      '/workshop-configuration/initialize/',
      {
        method: 'POST',
        body: { ...payload, idempotency_key: 'test-key' },
      },
    )
  })
})

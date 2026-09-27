import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createWorkshopConfigApi } from '../api'

function setup() {
  const request = vi.fn().mockResolvedValue({})
  const api = createWorkshopConfigApi({ request } as unknown as ApiClient)
  return { api, request }
}

describe('logotipo de entidad fiscal', () => {
  it('sube el archivo en multipart con su clave de idempotencia', async () => {
    const { api, request } = setup()
    const file = new File(['x'], 'logo.png', { type: 'image/png' })

    await api.uploadEntityLogo(2, file, 'clave-logo-1')

    const [path, options] = request.mock.calls[0] as [
      string,
      { method: string; body: FormData },
    ]
    expect(path).toBe('/workshop-configuration/entities/2/logo/')
    expect(options.method).toBe('POST')
    expect(options.body.get('file')).toBe(file)
    expect(options.body.get('idempotency_key')).toBe('clave-logo-1')
  })

  it('quita el logotipo con su clave de idempotencia', async () => {
    const { api, request } = setup()
    await api.removeEntityLogo(1, 'clave-logo-2')
    expect(request).toHaveBeenCalledWith(
      '/workshop-configuration/entities/1/logo/remove/',
      { method: 'POST', body: { idempotency_key: 'clave-logo-2' } },
    )
  })
})

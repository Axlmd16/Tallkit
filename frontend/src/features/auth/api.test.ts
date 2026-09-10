import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiClient } from '@/shared/api/client'

import { createAuthApi } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('auth api', () => {
  it('logs in and refreshes the rotated CSRF token', async () => {
    document.cookie = 'csrftoken=token; path=/'
    const session = {
      authenticated: true as const,
      username: 'operador',
      roles: ['VENDEDOR'],
      permissions: ['ventas.crear'],
      must_change_password: false,
    }
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(session), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)

    await expect(
      createAuthApi(new ApiClient('/api/v1')).login('operador', 'secreta'),
    ).resolves.toEqual(session)

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/login/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'operador', password: 'secreta' }),
      }),
    )
  })

  it('consults, logs out and changes password through the shared client', async () => {
    document.cookie = 'csrftoken=token; path=/'
    const anonymous = {
      authenticated: false as const,
      username: null,
      roles: [],
      permissions: [],
      must_change_password: false,
    }
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(anonymous), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const api = createAuthApi(new ApiClient('/api/v1'))

    await expect(api.getSession()).resolves.toEqual(anonymous)
    await expect(api.logout()).resolves.toBeUndefined()
    await expect(
      api.changePassword('anterior', 'Nueva-clave-segura-2026'),
    ).resolves.toBeUndefined()
  })
})

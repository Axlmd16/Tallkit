import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiClient, ProblemError } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('ApiClient', () => {
  it('obtains CSRF and sends same-origin credentials and the cookie token', async () => {
    document.cookie = 'csrftoken=token-seguro; path=/'
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ saved: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    const client = new ApiClient('/api/v1')

    await expect(
      client.request<{ saved: boolean }>('/users/', {
        method: 'POST',
        body: { username: 'ana' },
      }),
    ).resolves.toEqual({ saved: true })

    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/v1/auth/csrf/', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/v1/users/',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRFToken': 'token-seguro',
        },
        body: JSON.stringify({ username: 'ana' }),
      }),
    )
  })

  it('normalizes problem details without losing their stable code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Solicitud inválida',
            detail: 'Los roles no son válidos.',
            status: 400,
            code: 'invalid_roles',
            request_id: 'request-1',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    await expect(new ApiClient('/api/v1').request('/users/')).rejects.toEqual(
      new ProblemError(
        'Los roles no son válidos.',
        400,
        'invalid_roles',
        'request-1',
      ),
    )
  })

  it('normalizes network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')),
    )

    await expect(new ApiClient('/api/v1').request('/health/')).rejects.toEqual(
      new ProblemError(
        'No fue posible conectar con el backend.',
        0,
        'network_error',
      ),
    )
  })

  it('preserves field errors and conflict reference on ProblemError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Conflicto con el estado actual',
            detail: 'Ya existe un cliente con esta identificación.',
            status: 409,
            code: 'duplicate_identification',
            request_id: 'req-conflict-1',
            errors: {
              identification: ['Ya existe un cliente con esta identificación.'],
            },
            conflict: {
              type: 'customer',
              id: 42,
            },
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    const error: unknown = await new ApiClient('/api/v1')
      .request('/customers/')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProblemError)
    if (!(error instanceof ProblemError)) {
      throw new Error('Expected ProblemError')
    }
    expect(error.message).toBe('Ya existe un cliente con esta identificación.')
    expect(error.status).toBe(409)
    expect(error.code).toBe('duplicate_identification')
    expect(error.requestId).toBe('req-conflict-1')
    expect(error.errors).toEqual({
      identification: ['Ya existe un cliente con esta identificación.'],
    })
    expect(error.conflict).toEqual({
      type: 'customer',
      id: 42,
    })
  })
})

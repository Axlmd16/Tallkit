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

  it('sends FormData without forcing a content type and keeps CSRF', async () => {
    document.cookie = 'csrftoken=token-form; path=/'
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 201 }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    const client = new ApiClient('/api/v1')
    const form = new FormData()
    form.append('description', 'Golpe')

    await client.request('/maintenance-orders/1/photos/', {
      method: 'POST',
      body: form,
    })

    const init = fetchSpy.mock.calls[1]?.[1] as RequestInit
    expect(init.body).toBe(form)
    expect(init.headers).toEqual({
      Accept: 'application/json',
      'X-CSRFToken': 'token-form',
    })
  })

  it('exposes problem details when the server sends them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: 'Kilometraje menor.',
            status: 400,
            code: 'odometer_confirmation_required',
            details: { last_known_km: 90000, order_number: 'ART-OT-000001' },
          }),
          { status: 400 },
        ),
      ),
    )
    const error = await new ApiClient('/api/v1')
      .request('/maintenance-orders/')
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ProblemError)
    expect((error as ProblemError).details).toEqual({
      last_known_km: 90000,
      order_number: 'ART-OT-000001',
    })
  })

  it('sends explicit idempotency headers and accepts PUT', async () => {
    document.cookie = 'csrftoken=token-put; path=/'
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ revision: 1 }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchSpy)

    await new ApiClient('/api/v1').request('/fiscal/profile/', {
      method: 'PUT',
      headers: { 'Idempotency-Key': 'profile-attempt-1' },
      body: { expected_revision: 0 },
    })

    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Idempotency-Key': 'profile-attempt-1',
          'X-CSRFToken': 'token-put',
        }),
      }),
    )
  })

  it('downloads private binary responses without parsing them as JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('<factura/>', {
          status: 200,
          headers: { 'Content-Type': 'application/xml' },
        }),
      ),
    )

    const result = await new ApiClient('/api/v1').requestBlob(
      '/fiscal/archive/id/download/',
    )
    expect(await result.text()).toBe('<factura/>')
  })
})

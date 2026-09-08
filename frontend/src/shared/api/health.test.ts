import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, getHealth } from './health'

afterEach(() => vi.unstubAllGlobals())

describe('getHealth', () => {
  it('requests the versioned health endpoint with same-origin credentials', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await expect(getHealth('/api/v1')).resolves.toEqual({ status: 'ok' })
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/health/', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  })

  it('normalizes an unavailable backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    )

    await expect(getHealth('/api/v1')).rejects.toEqual(
      new ApiError('El backend no está disponible.', 503),
    )
  })

  it('normalizes a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')),
    )

    await expect(getHealth('/api/v1')).rejects.toEqual(
      new ApiError('No fue posible conectar con el backend.', 0),
    )
  })

  it('rejects an invalid success payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ status: 'unknown' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(getHealth('/api/v1')).rejects.toEqual(
      new ApiError('El backend devolvió una respuesta no válida.', 200),
    )
  })
})

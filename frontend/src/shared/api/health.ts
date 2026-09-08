export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export async function getHealth(
  _apiBaseUrl: string,
): Promise<{ status: 'ok' }> {
  let response: Response
  try {
    response = await fetch(`${_apiBaseUrl}/health/`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new ApiError('No fue posible conectar con el backend.', 0)
  }

  if (!response.ok) {
    throw new ApiError('El backend no está disponible.', response.status)
  }

  const payload: unknown = await response.json()
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('status' in payload) ||
    payload.status !== 'ok'
  ) {
    throw new ApiError(
      'El backend devolvió una respuesta no válida.',
      response.status,
    )
  }
  return { status: 'ok' }
}

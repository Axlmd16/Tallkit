export class ProblemError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(message)
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

function cookieValue(name: string): string | undefined {
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function isMutation(method: string): boolean {
  return method !== 'GET'
}

export class ApiClient {
  private csrfToken: string | undefined

  constructor(private readonly baseUrl: string) {}

  async refreshCsrf(): Promise<void> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/auth/csrf/`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
    } catch {
      throw new ProblemError(
        'No fue posible conectar con el backend.',
        0,
        'network_error',
      )
    }
    if (!response.ok) await this.throwProblem(response)
    this.csrfToken = cookieValue('csrftoken')
    if (!this.csrfToken) {
      throw new ProblemError(
        'No fue posible preparar una operación segura.',
        response.status,
        'missing_csrf_token',
      )
    }
  }

  async request<T = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const method = options.method ?? 'GET'
    if (isMutation(method) && !this.csrfToken) await this.refreshCsrf()

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (isMutation(method) && this.csrfToken)
      headers['X-CSRFToken'] = this.csrfToken

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        credentials: 'same-origin',
        headers,
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      })
    } catch {
      throw new ProblemError(
        'No fue posible conectar con el backend.',
        0,
        'network_error',
      )
    }

    if (!response.ok) await this.throwProblem(response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  private async throwProblem(response: Response): Promise<never> {
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    if (typeof payload === 'object' && payload !== null) {
      const problem = payload as Record<string, unknown>
      throw new ProblemError(
        typeof problem.detail === 'string'
          ? problem.detail
          : 'La solicitud no pudo completarse.',
        response.status,
        typeof problem.code === 'string' ? problem.code : 'request_failed',
        typeof problem.request_id === 'string' ? problem.request_id : undefined,
      )
    }
    throw new ProblemError(
      'La solicitud no pudo completarse.',
      response.status,
      'request_failed',
    )
  }
}

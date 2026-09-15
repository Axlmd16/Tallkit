export interface AppEnvironment {
  apiBaseUrl: string
  appName: string
}

export function parseEnvironment(
  _values: Record<string, unknown>,
): AppEnvironment {
  const apiBaseUrl = _values.VITE_API_BASE_URL ?? '/api/v1'
  const appName = _values.VITE_APP_NAME ?? 'Tallkit'

  if (
    typeof apiBaseUrl !== 'string' ||
    !apiBaseUrl.startsWith('/') ||
    apiBaseUrl.startsWith('//')
  ) {
    throw new Error('VITE_API_BASE_URL debe ser una ruta del mismo origen')
  }
  if (typeof appName !== 'string' || appName.trim().length === 0) {
    throw new Error('VITE_APP_NAME debe contener texto')
  }

  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ''), appName }
}

export const environment = parseEnvironment(import.meta.env)

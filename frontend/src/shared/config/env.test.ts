import { describe, expect, it } from 'vitest'

import { parseEnvironment } from './env'

describe('parseEnvironment', () => {
  it('uses a same-origin API path', () => {
    expect(parseEnvironment({ VITE_API_BASE_URL: '/api/v1' })).toEqual({
      apiBaseUrl: '/api/v1',
      appName: 'Tallkit',
    })
  })

  it('rejects a cross-origin API URL', () => {
    expect(() =>
      parseEnvironment({ VITE_API_BASE_URL: 'https://example.com/api' }),
    ).toThrow('VITE_API_BASE_URL debe ser una ruta del mismo origen')
  })

  it('rejects an empty application name', () => {
    expect(() => parseEnvironment({ VITE_APP_NAME: '  ' })).toThrow(
      'VITE_APP_NAME debe contener texto',
    )
  })
})

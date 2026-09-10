import { ApiClient, ProblemError } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type { Role, Session } from './types'

const roles = new Set<Role>(['ADMINISTRADOR', 'VENDEDOR', 'ENCARGADO_TALLER'])

function parseSession(payload: unknown): Session {
  if (typeof payload !== 'object' || payload === null) {
    throw new ProblemError(
      'La sesión recibida no es válida.',
      200,
      'invalid_session',
    )
  }
  const value = payload as Record<string, unknown>
  if (
    typeof value.authenticated !== 'boolean' ||
    !(typeof value.username === 'string' || value.username === null) ||
    !Array.isArray(value.roles) ||
    !value.roles.every((role) => roles.has(role as Role)) ||
    !Array.isArray(value.permissions) ||
    !value.permissions.every((permission) => typeof permission === 'string') ||
    typeof value.must_change_password !== 'boolean'
  ) {
    throw new ProblemError(
      'La sesión recibida no es válida.',
      200,
      'invalid_session',
    )
  }
  return {
    authenticated: value.authenticated,
    username: value.username,
    roles: value.roles as Role[],
    permissions: value.permissions as string[],
    must_change_password: value.must_change_password,
  }
}

export function createAuthApi(client: ApiClient) {
  return {
    async getSession(): Promise<Session> {
      return parseSession(await client.request('/auth/session/'))
    },
    async login(username: string, password: string): Promise<Session> {
      const session = parseSession(
        await client.request('/auth/login/', {
          method: 'POST',
          body: { username, password },
        }),
      )
      await client.refreshCsrf()
      return session
    },
    logout(): Promise<void> {
      return client.request('/auth/logout/', { method: 'POST' })
    },
    changePassword(
      currentPassword: string,
      newPassword: string,
    ): Promise<void> {
      return client.request('/auth/change-password/', {
        method: 'POST',
        body: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      })
    },
  }
}

export type AuthApi = ReturnType<typeof createAuthApi>
export const authApi = createAuthApi(new ApiClient(environment.apiBaseUrl))

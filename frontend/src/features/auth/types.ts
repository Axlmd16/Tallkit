export type Role = 'ADMINISTRADOR' | 'VENDEDOR' | 'ENCARGADO_TALLER'

export interface Session {
  authenticated: boolean
  username: string | null
  roles: Role[]
  permissions: string[]
  must_change_password: boolean
}

export const anonymousSession: Session = {
  authenticated: false,
  username: null,
  roles: [],
  permissions: [],
  must_change_password: false,
}

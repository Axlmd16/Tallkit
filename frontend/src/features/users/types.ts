import type { Role } from '@/features/auth/types'

export interface UserSummary {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  roles: Role[]
}

export interface UserPage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: UserSummary[]
}

export interface UserWrite {
  username: string
  first_name: string
  last_name: string
  email: string
  roles: Role[]
}

export interface UserFilters {
  search?: string
  isActive?: boolean
  role?: Role
  page?: number
}

export interface RoleDefinition {
  code: Role
  permissions: string[]
}

export type PersonType = 'NATURAL' | 'JURIDICA'
export type IdentificationType = 'CI' | 'RUC'

export interface CustomerSummary {
  id: number
  person_type: PersonType
  identification_type: IdentificationType
  identification: string
  name: string
  phone: string
  email: string | null
  address: string | null
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export type CustomerDetail = CustomerSummary

export interface CustomerPage {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: CustomerSummary[]
}

export interface CustomerWrite {
  person_type: PersonType
  identification_type: IdentificationType
  identification: string
  name: string
  phone: string
  email?: string | undefined
  address?: string | undefined
  expected_version?: number | undefined
}

export interface CustomerFilters {
  search?: string | undefined
  isActive?: boolean | undefined
  page?: number | undefined
}

export interface CustomerMatchQuery {
  name?: string | undefined
  phone?: string | undefined
  exclude_id?: number | undefined
}

export interface CustomerMatch {
  id: number
  person_type: PersonType
  identification_type: IdentificationType
  identification: string
  name: string
  phone: string
  is_active: boolean
}

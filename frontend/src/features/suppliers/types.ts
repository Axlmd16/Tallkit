export type SupplierIdentificationType = 'CI' | 'RUC'

export interface Supplier {
  id: number
  name: string
  identification_type: SupplierIdentificationType | null
  identification: string | null
  phone: string
  email: string
  address: string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface SupplierInput {
  name: string
  identification_type: SupplierIdentificationType | null
  identification: string | null
  phone: string
  email: string
  address: string
}

export type SupplierUpdate = Partial<SupplierInput> & {
  expected_version: number
}

export interface SupplierMatch {
  id: number
  name: string
  is_active: boolean
}

export interface SupplierMatches {
  results: SupplierMatch[]
  has_more: boolean
}

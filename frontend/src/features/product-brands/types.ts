export interface ProductBrand {
  id: number
  name: string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface ProductBrandInput {
  name: string
}

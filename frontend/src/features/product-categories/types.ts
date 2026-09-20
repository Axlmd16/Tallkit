export interface ProductCategory {
  id: number
  name: string
  description: string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface ProductCategoryInput {
  name: string
  description?: string
}

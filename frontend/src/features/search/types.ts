export interface SearchOpenOrder {
  id: number
  number: string
  status: string
}

export interface SearchVehicleItem {
  id: number
  plate: string
  label: string
  owner_id: number | null
  owner_name: string
  open_order: SearchOpenOrder | null
}

export interface SearchCustomerItem {
  id: number
  full_name: string
  identification_type: string
  identification: string
}

export type SearchInvoiceEntity = 'COMERCIAL' | 'ARTESANAL'
export type SearchInvoiceState = 'DRAFT' | 'PREPARED' | 'CANCELLED'

export interface SearchInvoiceItem {
  id: string
  entity: SearchInvoiceEntity
  number: string | null
  customer_name: string | null
  date: string | null
  state: SearchInvoiceState
  total: string | null
}

export interface SearchProductItem {
  id: number
  code: string
  manufacturer_code: string
  name: string
  sale_price: string
  stock: string | null
}

export interface SearchGroup<T> {
  total: number
  items: T[]
}

export interface GlobalSearchResponse {
  query: string
  vehicles: SearchGroup<SearchVehicleItem> | null
  customers: SearchGroup<SearchCustomerItem> | null
  invoices: SearchGroup<SearchInvoiceItem> | null
  products: SearchGroup<SearchProductItem> | null
}

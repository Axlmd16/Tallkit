/** Ámbito fiscal tal como lo entrega el resumen del servidor. */
export type HomeScope = 'commercial' | 'artisan'

export type PendingKey =
  | 'open_orders'
  | 'cash_sales_unpaid'
  | 'cash_services_unpaid'
  | 'proformas_expiring'
  | 'withholdings_pending'
  | 'sale_drafts'
  | 'proforma_drafts'

export interface PendingItem {
  key: PendingKey
  scope: HomeScope | null
  count: number
}

export interface QualificationNotice {
  entity_id: number
  expires_on: string
  days_left: number
  expired: boolean
}

export interface HomePending {
  items: PendingItem[]
  qualification: QualificationNotice | null
}

export interface ReceivableItem {
  scope: HomeScope
  /** Saldo pendiente como decimal exacto. */
  balance: string
  customers: number
}

export interface HomeReceivables {
  items: ReceivableItem[]
}

export interface CollectionDay {
  date: string
  amount: string
}

export interface CollectionItem {
  scope: HomeScope
  total: string
  days: CollectionDay[]
}

export interface HomeCollections {
  timezone: string
  items: CollectionItem[]
}

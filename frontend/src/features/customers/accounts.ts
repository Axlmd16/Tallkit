import { useQuery } from '@tanstack/react-query'

import { ApiClient } from '@/shared/api/client'
import { environment } from '@/shared/config/env'

import type { PersonType } from './types'

/** Cliente con deuda: el saldo de cada negocio por separado; `null` sin deuda o sin permiso. */
export interface Debtor {
  customer_id: number
  name: string
  identification: string
  person_type: PersonType
  commercial: string | null
  artisan: string | null
}

export interface Debtors {
  items: Debtor[]
  visible: { commercial: boolean; artisan: boolean }
}

/** Lo de un negocio con el cliente. Cada dato es `null` si falta el permiso que lo muestra. */
export interface CustomerBusinessAccount {
  spent_year: string | null
  documents_year: number | null
  last_on: string | null
  balance: string | null
}

export interface CustomerAccountSummary {
  customer_id: number
  year: number
  visits: { count_year: number; last_on: string | null } | null
  commercial: CustomerBusinessAccount | null
  artisan: CustomerBusinessAccount | null
}

const client = new ApiClient(environment.apiBaseUrl)

export const customerAccountsApi = {
  debtors: () => client.request<Debtors>('/home/customers/debtors/'),
  summary: (id: number) =>
    client.request<CustomerAccountSummary>(`/home/customers/${id}/summary/`),
}

export const customerAccountKeys = {
  debtors: ['customers', 'accounts', 'debtors'] as const,
  summary: (id: number) => ['customers', 'accounts', 'summary', id] as const,
}

/** Clientes con deuda en los negocios que la sesión puede ver. Lo calcula el servidor. */
export function useCustomerDebtors(enabled = true) {
  return useQuery({
    queryKey: customerAccountKeys.debtors,
    queryFn: () => customerAccountsApi.debtors(),
    enabled,
    staleTime: 30_000,
  })
}

/** Visitas, gasto del año y deuda de un cliente, cada negocio por separado. */
export function useCustomerAccountSummary(id: number | null) {
  return useQuery({
    queryKey: customerAccountKeys.summary(id ?? 0),
    queryFn: () => customerAccountsApi.summary(id as number),
    enabled: typeof id === 'number' && id > 0,
  })
}

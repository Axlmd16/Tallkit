import { useCustomerOptions, useProductOptions } from './hooks'
import type { ComboboxResults } from '@/shared/ui'

export function useCustomerPickerOptions(
  term: string,
  page: number,
): ComboboxResults {
  const query = useCustomerOptions(term, page)
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((c) => ({
        id: c.id,
        label: c.name,
        detail: `${c.identification_type} ${c.identification}`,
      })),
    },
  }
}

export function useProductPickerOptions(
  term: string,
  page: number,
): ComboboxResults {
  const query = useProductOptions(term, page)
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((p) => ({
        id: p.id,
        label: `${p.code} — ${p.name}`,
        detail: `Precio final USD ${p.unit_price}${p.is_kit ? ' · Kit completo' : ''}`,
      })),
    },
  }
}

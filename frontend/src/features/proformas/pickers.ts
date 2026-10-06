import type { ComboboxResults } from '@/shared/ui'

import { useProformaCustomerOptions, useProformaProductOptions } from './hooks'

export function useCustomerPickerOptions(
  term: string,
  page: number,
): ComboboxResults {
  const query = useProformaCustomerOptions(term, page)
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((customer) => ({
        id: customer.id,
        label: customer.name,
        detail: `${customer.identification_type} ${customer.identification}`,
      })),
    },
  }
}

/** El precio es el final de catálogo y la disponibilidad es solo informativa. */
export function useProductPickerOptions(
  term: string,
  page: number,
): ComboboxResults {
  const query = useProformaProductOptions(term, page)
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((product) => ({
        id: product.id,
        label: `${product.code} — ${product.name}`,
        detail: [
          `Precio final USD ${product.unit_price}`,
          product.available === null ? null : `Disponible ${product.available}`,
          product.is_kit ? 'Kit completo' : null,
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    },
  }
}

import { useQuery } from '@tanstack/react-query'

import { useProducts } from '@/features/products/hooks'

import { purchasesApi } from './api'
import { purchaseKeys } from './hooks'

import type { ComboboxResults } from '@/shared/ui'

/** Proveedores activos con solo su nombre: quien registra entradas no ve más datos. */
export function useSupplierOptions(
  term: string,
  page: number,
): ComboboxResults {
  const query = useQuery({
    queryKey: purchaseKeys.suppliers(term, page),
    queryFn: () => purchasesApi.supplierOptions(term, page),
  })
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((s) => ({ id: s.id, label: s.name })),
    },
  }
}

/** Productos para el ajuste de inventario: los inactivos se etiquetan y no se eligen. */
export function useProductOptions(term: string, page: number): ComboboxResults {
  const query = useProducts({
    search: term || undefined,
    isActive: 'all',
    page,
  })
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    data: query.data && {
      totalPages: query.data.total_pages,
      options: query.data.results.map((p) => ({
        id: p.id,
        label: `${p.code} — ${p.name}`,
        detail: p.unit?.name,
        inactive: !p.is_active,
      })),
    },
  }
}

/** Productos activos para sugerir al escribir; el servidor busca por código o nombre. */
export function useProductSuggestions(term: string) {
  return useProducts({
    search: term || undefined,
    isActive: 'true',
    pageSize: 8,
  })
}

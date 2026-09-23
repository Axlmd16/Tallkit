import { useProducts } from '@/features/products/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'

import type { ComboboxResults } from '@/shared/ui'

/** Proveedores de todos los estados: los inactivos se etiquetan y no se eligen. */
export function useSupplierOptions(
  term: string,
  page: number,
): ComboboxResults {
  const query = useSuppliers({
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
      options: query.data.results.map((s) => ({
        id: s.id,
        label: s.name,
        detail: s.identification
          ? `${s.identification_type} ${s.identification}`
          : undefined,
        inactive: !s.is_active,
      })),
    },
  }
}

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
        detail: [p.unit?.name, p.tax ? `Impuesto sugerido ${p.tax.code}` : '']
          .filter(Boolean)
          .join(' · '),
        inactive: !p.is_active,
        taxDefinitionId: p.tax?.id,
      })),
    },
  }
}

import { useSearchParams } from 'react-router'

import type { ActiveFilter } from '@/shared/api/catalog-resource'

const ACTIVE_VALUES: readonly ActiveFilter[] = ['true', 'false', 'all']

/**
 * Filtros y página en la URL para conservar el contexto al volver. El estado
 * «activos» es el valor por omisión y no se escribe en la dirección.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams()
  const rawActive = params.get('is_active')
  const isActive: ActiveFilter = ACTIVE_VALUES.includes(
    rawActive as ActiveFilter,
  )
    ? (rawActive as ActiveFilter)
    : 'true'
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1)

  function set(changes: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(params)
    for (const [name, value] of Object.entries(changes)) {
      const empty =
        value === undefined ||
        value === '' ||
        (name === 'is_active' && value === 'true') ||
        (name === 'page' && Number(value) <= 1)
      if (empty) next.delete(name)
      else next.set(name, String(value))
    }
    if (!('page' in changes) && !('ficha' in changes)) next.delete('page')
    setParams(next)
  }

  return {
    get: (name: string) => params.get(name) ?? '',
    getNumber: (name: string): number | undefined => {
      const value = parseInt(params.get(name) ?? '', 10)
      return Number.isFinite(value) && value > 0 ? value : undefined
    },
    search: params.get('search') ?? '',
    isActive,
    page,
    set,
    /** Hay algún filtro distinto del valor por omisión. */
    filtered: Array.from(params.keys()).some(
      (name) => name !== 'page' && name !== 'ficha',
    ),
  }
}

export type UrlFilters = ReturnType<typeof useUrlFilters>

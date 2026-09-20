import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'

import type { BaseFilters, CatalogResource } from './catalog-resource'

interface Options<Item, Filters extends BaseFilters> {
  /** Raíz de las claves de consulta de la capacidad. */
  key: string
  api: CatalogResource<Item, Filters>
  /** Raíces cuyas consultas dependen de este catálogo y se invalidan al mutarlo. */
  related?: string[]
}

export const catalogKeys = {
  list: (root: string, filters: object) => [root, 'list', filters] as const,
  detail: (root: string, id: number | null) => [root, 'detail', id] as const,
}

/**
 * Consultas y mutaciones TanStack Query de un catálogo. Tras cada escritura
 * invalida listas, fichas y las consultas relacionadas; la ficha vigente se
 * vuelve a consultar aun después de un replay idempotente.
 */
export function createCatalogHooks<
  Item extends { id: number },
  Filters extends BaseFilters = BaseFilters,
>({ key, api, related = [] }: Options<Item, Filters>) {
  function useList(filters: Filters = {} as Filters) {
    return useQuery({
      queryKey: catalogKeys.list(key, filters),
      queryFn: () => api.list(filters),
      refetchOnWindowFocus: true,
    })
  }

  function useDetail(id: number | null) {
    return useQuery({
      queryKey: catalogKeys.detail(key, id),
      queryFn: () => api.get(id as number),
      enabled: typeof id === 'number' && id > 0,
      refetchOnWindowFocus: true,
    })
  }

  function useMutations() {
    const queryClient = useQueryClient()
    const invalidate = async () => {
      const roots: QueryKey[] = [[key], ...related.map((root) => [root])]
      await Promise.all(
        roots.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
    }
    const create = useMutation({
      mutationFn: ({ data, key: idem }: { data: object; key: string }) =>
        api.create(data, idem),
      onSuccess: invalidate,
    })
    const update = useMutation({
      mutationFn: ({
        id,
        data,
        key: idem,
      }: {
        id: number
        data: object
        key: string
      }) => api.update(id, data, idem),
      onSuccess: invalidate,
    })
    const setActive = useMutation({
      mutationFn: ({
        id,
        active,
        expectedVersion,
        key: idem,
      }: {
        id: number
        active: boolean
        expectedVersion: number
        key: string
      }) => api.setActive(id, active, expectedVersion, idem),
      onSuccess: invalidate,
    })
    return { create, update, setActive }
  }

  return { useList, useDetail, useMutations }
}

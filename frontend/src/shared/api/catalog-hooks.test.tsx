import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

import type { CatalogResource } from './catalog-resource'
import { createCatalogHooks } from './catalog-hooks'

interface Item {
  id: number
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const api = {
    list: vi.fn().mockResolvedValue({ count: 0, results: [] }),
    get: vi.fn().mockResolvedValue({ id: 1 }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    setActive: vi.fn().mockResolvedValue({ id: 1 }),
  } as unknown as CatalogResource<Item>
  const hooks = createCatalogHooks<Item>({
    key: 'things',
    api,
    related: ['products'],
  })
  return { client, wrapper, api, hooks }
}

it('usa claves por capacidad, filtros e ID', async () => {
  const { client, wrapper, hooks } = setup()
  renderHook(() => hooks.useList({ search: 'a' }), { wrapper })
  renderHook(() => hooks.useDetail(5), { wrapper })
  await waitFor(() => {
    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
    expect(keys).toContainEqual(['things', 'list', { search: 'a' }])
    expect(keys).toContainEqual(['things', 'detail', 5])
  })
})

it('no consulta una ficha sin ID', () => {
  const { api, wrapper, hooks } = setup()
  renderHook(() => hooks.useDetail(null), { wrapper })
  expect(api.get).not.toHaveBeenCalled()
})

it('invalida listas, fichas y consultas relacionadas tras mutar', async () => {
  const { client, wrapper, api, hooks } = setup()
  const spy = vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHook(() => hooks.useMutations(), { wrapper })

  await act(async () => {
    await result.current.create.mutateAsync({ data: { a: 1 }, key: 'key-0001' })
  })
  await act(async () => {
    await result.current.setActive.mutateAsync({
      id: 1,
      active: false,
      expectedVersion: 1,
      key: 'key-0002',
    })
  })

  expect(api.create).toHaveBeenCalledWith({ a: 1 }, 'key-0001')
  expect(api.setActive).toHaveBeenCalledWith(1, false, 1, 'key-0002')
  const roots = spy.mock.calls.map((call) => call[0]?.queryKey)
  expect(roots.filter((k) => k?.[0] === 'things')).toHaveLength(2)
  expect(roots.filter((k) => k?.[0] === 'products')).toHaveLength(2)
})

it('no reintenta automáticamente una mutación fallida', async () => {
  const { api, wrapper, hooks } = setup()
  vi.mocked(api.create).mockRejectedValue(new Error('sin red'))
  const { result } = renderHook(() => hooks.useMutations(), { wrapper })
  await act(async () => {
    await result.current.create
      .mutateAsync({ data: {}, key: 'key-0003' })
      .catch(() => undefined)
  })
  expect(api.create).toHaveBeenCalledTimes(1)
})

it('libera las consultas del catálogo al limpiar la caché de la sesión', async () => {
  const { client, wrapper, hooks } = setup()
  renderHook(() => hooks.useList({ search: 'a' }), { wrapper })
  await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1))
  client.clear()
  expect(client.getQueryCache().getAll()).toHaveLength(0)
})

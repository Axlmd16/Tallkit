import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  supplierOptions: vi.fn(),
  products: vi.fn(),
}))
vi.mock('./api', () => ({
  purchasesApi: { supplierOptions: mocks.supplierOptions },
}))
vi.mock('@/features/products/hooks', () => ({
  useProducts: (filters: unknown) => mocks.products(filters),
}))

import { useProductSuggestions, useSupplierOptions } from './pickers'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('los proveedores salen de la selección mínima, solo con nombre', async () => {
  mocks.supplierOptions.mockResolvedValue({
    total_pages: 2,
    results: [
      { id: 1, name: 'Repuestos SA' },
      { id: 2, name: 'Lubricantes' },
    ],
  })
  const { result } = renderHook(() => useSupplierOptions('re', 1), {
    wrapper: wrapper(),
  })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(mocks.supplierOptions).toHaveBeenCalledWith('re', 1)
  expect(result.current.data).toEqual({
    totalPages: 2,
    options: [
      { id: 1, label: 'Repuestos SA' },
      { id: 2, label: 'Lubricantes' },
    ],
  })
})

it('las sugerencias de productos piden solo activos y una página corta', () => {
  mocks.products.mockReturnValue({ data: undefined })
  renderHook(() => useProductSuggestions('ace'))
  expect(mocks.products).toHaveBeenCalledWith({
    search: 'ace',
    isActive: 'true',
    pageSize: 8,
  })
  renderHook(() => useProductSuggestions(''))
  expect(mocks.products).toHaveBeenLastCalledWith({
    search: undefined,
    isActive: 'true',
    pageSize: 8,
  })
})

it('los productos del ajuste etiquetan los inactivos para no elegirlos', async () => {
  mocks.products.mockReturnValue({
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    data: {
      total_pages: 1,
      results: [
        {
          id: 5,
          code: 'ACE-1',
          name: 'Aceite',
          unit: { name: 'Galón' },
          is_active: true,
        },
        { id: 6, code: 'OLD-1', name: 'Viejo', unit: null, is_active: false },
      ],
    },
  })
  const { useProductOptions } = await import('./pickers')
  const { result } = renderHook(() => useProductOptions('a', 1))
  expect(mocks.products).toHaveBeenCalledWith({
    search: 'a',
    isActive: 'all',
    page: 1,
  })
  expect(result.current.data?.options).toEqual([
    { id: 5, label: 'ACE-1 — Aceite', detail: 'Galón', inactive: false },
    { id: 6, label: 'OLD-1 — Viejo', detail: undefined, inactive: true },
  ])
})

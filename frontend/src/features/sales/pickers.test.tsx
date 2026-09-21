import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  customers: {} as unknown,
  products: {} as unknown,
}))
vi.mock('./hooks', () => ({
  useCustomerOptions: () => mocks.customers,
  useProductOptions: () => mocks.products,
}))

import { useCustomerPickerOptions, useProductPickerOptions } from './pickers'

it('mapea clientes con su identificación y páginas totales', () => {
  mocks.customers = {
    isPending: false,
    isError: false,
    data: {
      total_pages: 3,
      results: [
        { id: 1, name: 'Ana', identification_type: 'CI', identification: '17' },
      ],
    },
  }
  const { result } = renderHook(() => useCustomerPickerOptions('', 1))
  expect(result.current.data?.totalPages).toBe(3)
  expect(result.current.data?.options[0]).toEqual({
    id: 1,
    label: 'Ana',
    detail: 'CI 17',
  })
})

it('mapea productos con su precio final y etiqueta los kits, sin costos', () => {
  mocks.products = {
    isPending: false,
    isError: false,
    data: {
      total_pages: 1,
      results: [
        { id: 5, code: 'K-1', name: 'Kit', unit_price: '11.50', is_kit: true },
      ],
    },
  }
  const { result } = renderHook(() => useProductPickerOptions('', 1))
  const option = result.current.data?.options[0]
  expect(option?.label).toBe('K-1 — Kit')
  expect(option?.detail).toBe('Precio final USD 11.50 · Kit completo')
  expect(JSON.stringify(option).toLowerCase()).not.toContain('cost')
})

it('propaga el estado de carga y de error para conservar la entrada del usuario', () => {
  mocks.products = { isPending: true, isError: false, refetch: vi.fn() }
  expect(
    renderHook(() => useProductPickerOptions('x', 2)).result.current.isPending,
  ).toBe(true)
  mocks.products = { isPending: false, isError: true, refetch: vi.fn() }
  expect(
    renderHook(() => useProductPickerOptions('x', 2)).result.current.isError,
  ).toBe(true)
})

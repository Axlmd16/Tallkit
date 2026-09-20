import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  suppliers: {} as Record<string, unknown>,
  products: {} as Record<string, unknown>,
  args: [] as unknown[],
}))
vi.mock('@/features/suppliers/hooks', () => ({
  useSuppliers: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.suppliers
  },
}))
vi.mock('@/features/products/hooks', () => ({
  useProducts: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.products
  },
}))

import { useProductOptions, useSupplierOptions } from './pickers'

beforeEach(() => {
  mocks.args.length = 0
  mocks.suppliers = {
    isPending: false,
    isError: false,
    data: {
      total_pages: 2,
      results: [
        {
          id: 1,
          name: 'Repuestos SA',
          identification_type: 'RUC',
          identification: '1790012345001',
          is_active: true,
        },
        {
          id: 2,
          name: 'Cerrado',
          identification_type: null,
          identification: null,
          is_active: false,
        },
      ],
    },
  }
  mocks.products = {
    isPending: false,
    isError: false,
    data: {
      total_pages: 1,
      results: [
        {
          id: 5,
          code: 'ACE-1',
          name: 'Aceite',
          unit: { name: 'Galón' },
          tax: { id: 9, code: 'IVA' },
          is_active: true,
        },
        {
          id: 6,
          code: 'OLD',
          name: 'Vieja',
          unit: null,
          tax: null,
          is_active: false,
        },
      ],
    },
  }
})

it('los proveedores se consultan con todos los estados y los inactivos se marcan', () => {
  const { result } = renderHook(() => useSupplierOptions('repuestos', 2))
  expect(mocks.args[0]).toEqual({
    search: 'repuestos',
    isActive: 'all',
    page: 2,
  })
  expect(result.current.data?.totalPages).toBe(2)
  expect(result.current.data?.options[0]).toMatchObject({
    label: 'Repuestos SA',
    detail: 'RUC 1790012345001',
    inactive: false,
  })
  expect(result.current.data?.options[1]).toMatchObject({ inactive: true })
})

it('los productos exponen código, unidad, impuesto sugerido y estado', () => {
  const { result } = renderHook(() => useProductOptions('', 1))
  expect(mocks.args[0]).toEqual({ search: undefined, isActive: 'all', page: 1 })
  expect(result.current.data?.options[0]).toMatchObject({
    label: 'ACE-1 — Aceite',
    detail: 'Galón · Impuesto sugerido IVA',
    taxDefinitionId: 9,
    inactive: false,
  })
  expect(result.current.data?.options[1]).toMatchObject({ inactive: true })
})

it('propaga los estados de carga y error sin inventar datos', () => {
  mocks.suppliers = { isPending: true, isError: false, data: undefined }
  const { result } = renderHook(() => useSupplierOptions('', 1))
  expect(result.current.isPending).toBe(true)
  expect(result.current.data).toBeUndefined()
})

import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queries: [] as Array<Record<string, unknown>>,
}))

vi.mock('../hooks', () => ({
  useElectronicStatus: (id: number) => mocks.queries[id - 1],
}))

import { useConfigurationReadiness } from './readiness'

it('suma pendientes y conserva el destino de la primera causa', () => {
  mocks.queries = [
    {
      isLoading: false,
      isError: false,
      data: {
        entity_id: 1,
        causes: [
          {
            code: 'payment_forms_missing',
            kind: 'MISSING',
            message: 'Faltan formas.',
          },
        ],
      },
    },
    {
      isLoading: false,
      isError: false,
      data: {
        entity_id: 2,
        causes: [
          {
            code: 'default_point_required',
            kind: 'MISSING',
            message: 'Falta punto.',
          },
        ],
      },
    },
  ]

  const { result } = renderHook(() => useConfigurationReadiness([1, 2]))
  expect(result.current.pending).toBe(2)
  expect(result.current.firstDestination).toEqual({
    entityId: 1,
    section: 'formas-pago',
  })
})

it('expone carga y error de las consultas fiscales', () => {
  mocks.queries = [
    { isLoading: true, isError: false, data: undefined },
    { isLoading: false, isError: true, data: undefined },
  ]

  const { result } = renderHook(() => useConfigurationReadiness([1, 2]))
  expect(result.current.isLoading).toBe(true)
  expect(result.current.isError).toBe(true)
})

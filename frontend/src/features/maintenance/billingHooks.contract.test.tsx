import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => {
  const names = [
    'parts',
    'economicSummary',
    'commercialView',
    'serviceOperation',
    'serviceOperationDocument',
    'voidPreview',
    'artisanReceivables',
    'changePart',
    'removePart',
    'confirmServiceOperation',
    'voidServiceOperation',
    'correctArtisanPayment',
  ] as const
  return Object.fromEntries(names.map((name) => [name, vi.fn()])) as Record<
    (typeof names)[number],
    ReturnType<typeof vi.fn>
  >
})
vi.mock('./api', () => ({ maintenanceApi: api }))

import {
  useArtisanReceivables,
  useBillingMutations,
  useCommercialView,
  useEconomicSummary,
  useOrderParts,
  useServiceOperation,
  useServiceOperationDocument,
  useVoidPreview,
} from './billingHooks'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

let client: QueryClient
beforeEach(() => {
  vi.resetAllMocks()
  for (const method of Object.values(api)) method.mockResolvedValue({ id: 5 })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

describe('consultas de facturación del mantenimiento', () => {
  const filters = { page: 2 } as never
  const cases: Array<[string, () => unknown, keyof typeof api, unknown[]]> = [
    ['repuestos', () => useOrderParts(3), 'parts', [3]],
    ['resumen económico', () => useEconomicSummary(3), 'economicSummary', [3]],
    ['vista comercial', () => useCommercialView(5), 'commercialView', [5]],
    ['operación', () => useServiceOperation(5), 'serviceOperation', [5]],
    [
      'documento de la operación',
      () => useServiceOperationDocument(5),
      'serviceOperationDocument',
      [5],
    ],
    [
      'vista previa de anulación',
      () => useVoidPreview(3, true),
      'voidPreview',
      [3],
    ],
    [
      'cuentas por cobrar artesanales',
      () => useArtisanReceivables(filters),
      'artisanReceivables',
      [filters],
    ],
  ]

  it.each(cases)(
    '%s consulta con su identificador',
    async (_, hook, method, args) => {
      const { result } = renderHook(hook as () => { isSuccess: boolean }, {
        wrapper: wrapper(client),
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api[method].mock.calls[0]).toEqual(args)
    },
  )

  it('no consulta sin identificador ni con la consulta desactivada', () => {
    const options = { wrapper: wrapper(client) }
    renderHook(() => useCommercialView(null), options)
    renderHook(() => useServiceOperation(null), options)
    renderHook(() => useServiceOperationDocument(0), options)
    renderHook(() => useOrderParts(3, false), options)
    renderHook(() => useEconomicSummary(3, false), options)
    renderHook(() => useVoidPreview(3, false), options)
    for (const method of [
      api.commercialView,
      api.serviceOperation,
      api.serviceOperationDocument,
      api.parts,
      api.economicSummary,
      api.voidPreview,
    ]) {
      expect(method).not.toHaveBeenCalled()
    }
  })
})

describe('mutaciones de facturación del mantenimiento', () => {
  const replacement = { operation_id: 'op-2', parts: [] }
  const cases: Array<[string, unknown, keyof typeof api, unknown[]]> = [
    [
      'changePart',
      { id: 3, lineId: 9, quantity: '2', expectedVersion: 1, key: 'k1' },
      'changePart',
      [3, 9, '2', 1, 'k1'],
    ],
    [
      'removePart',
      { id: 3, lineId: 9, expectedVersion: 1, key: 'k2' },
      'removePart',
      [3, 9, 1, 'k2'],
    ],
    [
      'confirmServices',
      {
        id: 5,
        condition: 'CONTADO',
        reviewDigest: 'dig',
        expectedVersion: 1,
        key: 'k3',
      },
      'confirmServiceOperation',
      [5, { condition: 'CONTADO', review_digest: 'dig' }, 1, 'k3'],
    ],
    [
      'voidOperation',
      { id: 5, reason: 'Error de digitación', expectedVersion: 2, key: 'k4' },
      'voidServiceOperation',
      [5, 'Error de digitación', 2, 'k4'],
    ],
    [
      'correctPayment',
      { id: 5, paymentId: 8, reason: 'Monto', factId: 'f1', key: 'k5' },
      'correctArtisanPayment',
      [5, 8, { reason: 'Monto' }, 'f1', 'k5'],
    ],
    [
      'correctPayment',
      {
        id: 5,
        paymentId: 8,
        reason: 'Monto',
        replacement,
        factId: 'f2',
        key: 'k6',
      },
      'correctArtisanPayment',
      [5, 8, { reason: 'Monto', replacement }, 'f2', 'k6'],
    ],
  ]

  it.each(cases)(
    '%s traduce sus variables a la llamada del API',
    async (name, variables, method, args) => {
      const { result } = renderHook(() => useBillingMutations(), {
        wrapper: wrapper(client),
      })
      const mutation = (
        result.current as unknown as Record<
          string,
          { mutateAsync: (variables: unknown) => Promise<unknown> }
        >
      )[name]!
      await act(async () => {
        await mutation.mutateAsync(variables)
      })
      expect(api[method].mock.calls[0]).toEqual(args)
    },
  )
})

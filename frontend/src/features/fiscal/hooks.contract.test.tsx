import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => {
  const names = [
    'getPreparation',
    'listCorrections',
    'getCorrection',
    'getReadiness',
    'getActivePreparation',
    'getElectronicStatus',
    'getPreparationDefaults',
    'getCatalog',
    'getTaxMappings',
    'getPaymentForms',
    'createPreparation',
    'createCorrection',
    'prepareCorrection',
    'cancelCorrection',
    'updateDraft',
    'review',
    'prepare',
    'uploadArchive',
    'linkArchive',
    'exportArchive',
    'saveElectronicProfile',
    'createEstablishment',
    'createPoint',
    'createTaxMapping',
    'scheduleTaxMappingSuccessor',
    'savePreparationDefaults',
    'setPaymentForm',
    'saveArchivePolicy',
    'recordRestoration',
  ] as const
  return Object.fromEntries(names.map((name) => [name, vi.fn()])) as Record<
    (typeof names)[number],
    ReturnType<typeof vi.fn>
  >
})
vi.mock('./api', () => ({ fiscalApi: api }))

import {
  fiscalKeys,
  useActivePreparation,
  useArchiveReadiness,
  useCatalog,
  useCorrection,
  useCorrections,
  useElectronicStatus,
  useFiscalMutations,
  usePaymentForms,
  usePreparation,
  usePreparationDefaults,
  useTaxMappings,
} from './hooks'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

let client: QueryClient
beforeEach(() => {
  vi.resetAllMocks()
  for (const method of Object.values(api)) method.mockResolvedValue({})
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

describe('consultas fiscales', () => {
  const cases: Array<[string, () => unknown, keyof typeof api, unknown[]]> = [
    ['preparación', () => usePreparation('p1'), 'getPreparation', ['p1']],
    ['correcciones', () => useCorrections(), 'listCorrections', []],
    ['corrección', () => useCorrection('r1'), 'getCorrection', ['r1']],
    [
      'preparación del archivo',
      () => useArchiveReadiness(2),
      'getReadiness',
      [2],
    ],
    [
      'preparación activa',
      () => useActivePreparation('COMMERCIAL', 7),
      'getActivePreparation',
      ['COMMERCIAL', 7],
    ],
    [
      'estado electrónico',
      () => useElectronicStatus(2),
      'getElectronicStatus',
      [2],
    ],
    [
      'valores predeterminados',
      () => usePreparationDefaults(2),
      'getPreparationDefaults',
      [2],
    ],
    [
      'catálogo',
      () => useCatalog('TAX_RATE', true),
      'getCatalog',
      ['TAX_RATE', true],
    ],
    ['correspondencias', () => useTaxMappings(2), 'getTaxMappings', [2]],
    ['formas de pago', () => usePaymentForms(2), 'getPaymentForms', [2]],
  ]

  it.each(cases)(
    '%s consulta al API con su identificador',
    async (_, hook, method, args) => {
      const { result } = renderHook(hook as () => { isSuccess: boolean }, {
        wrapper: wrapper(client),
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      // react-query añade contexto como último argumento a las funciones que recibe tal cual.
      expect(api[method].mock.calls[0]?.slice(0, args.length)).toEqual(args)
    },
  )

  it('la preparación activa exige un origen válido y la consulta habilitada', () => {
    const options = { wrapper: wrapper(client) }
    renderHook(() => useActivePreparation('COMMERCIAL', 0), options)
    renderHook(() => useActivePreparation('COMMERCIAL', 7, false), options)
    expect(api.getActivePreparation).not.toHaveBeenCalled()
  })

  it('el catálogo pide por defecto todas las entradas y no solo las seleccionables', async () => {
    const { result } = renderHook(() => useCatalog('PAYMENT_FORM'), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.getCatalog).toHaveBeenCalledWith('PAYMENT_FORM', false)
  })

  it('no consulta una preparación o corrección sin identificador', () => {
    renderHook(() => usePreparation(undefined), { wrapper: wrapper(client) })
    renderHook(() => useCorrection(null), { wrapper: wrapper(client) })
    expect(api.getPreparation).not.toHaveBeenCalled()
    expect(api.getCorrection).not.toHaveBeenCalled()
  })
})

describe('mutaciones fiscales', () => {
  const xml = new File(['<factura/>'], 'factura.xml')
  const cases: Array<[string, unknown, keyof typeof api, unknown[], unknown?]> =
    [
      [
        'createPreparation',
        { sourceKind: 'COMMERCIAL', sourceId: 7, attemptKey: 'k1' },
        'createPreparation',
        ['COMMERCIAL', 7, 'k1'],
      ],
      [
        'createCorrection',
        { data: { reason: 'Corrección' }, attemptKey: 'k2' },
        'createCorrection',
        [{ reason: 'Corrección' }, 'k2'],
      ],
      [
        'prepareCorrection',
        { requestId: 'r1', version: 2 },
        'prepareCorrection',
        ['r1', 2],
      ],
      [
        'cancelCorrection',
        { requestId: 'r1', version: 2, reason: 'Motivo' },
        'cancelCorrection',
        ['r1', 2, 'Motivo'],
      ],
      [
        'updateDraft',
        { preparationId: 'p1', data: { expected_version: 1 } },
        'updateDraft',
        ['p1', { expected_version: 1 }],
      ],
      ['review', { preparationId: 'p1' }, 'review', ['p1']],
      [
        'prepare',
        { preparationId: 'p1', reviewToken: 'tok', attemptKey: 'k3' },
        'prepare',
        ['p1', 'tok', 'k3'],
      ],
      [
        'uploadArchive',
        { entityId: 2, sourceLabel: 'Facturador SRI', xml },
        'uploadArchive',
        [2, 'Facturador SRI', xml],
      ],
      [
        'linkArchive',
        { dossierId: 'd1', data: { reason: 'Conciliación' } },
        'linkArchive',
        ['d1', { reason: 'Conciliación' }],
      ],
      [
        'exportArchive',
        { dossierIds: ['d1', 'd2'] },
        'exportArchive',
        [['d1', 'd2']],
      ],
      [
        'saveProfile',
        { entityId: 2, data: { expected_revision: 0 }, attemptKey: 'k4' },
        'saveElectronicProfile',
        [2, { expected_revision: 0 }, 'k4'],
        { entity_id: 2 },
      ],
      [
        'createEstablishment',
        { entityId: 2, code: '001', address: 'Matriz' },
        'createEstablishment',
        [2, '001', 'Matriz'],
      ],
      [
        'createPoint',
        { entityId: 2, establishmentId: 5, code: '002' },
        'createPoint',
        [5, '002'],
      ],
      [
        'createTaxMapping',
        {
          definition_id: 3,
          catalog_entry_id: 11,
          starts_on: '2026-01-01',
          source: 'SRI',
        },
        'createTaxMapping',
        [
          {
            definition_id: 3,
            catalog_entry_id: 11,
            starts_on: '2026-01-01',
            source: 'SRI',
          },
        ],
      ],
      [
        'scheduleTaxMappingSuccessor',
        {
          mappingId: 3,
          data: {
            catalog_entry_id: 4,
            starts_on: '2027-01-01',
            source: 'Cambio',
          },
        },
        'scheduleTaxMappingSuccessor',
        [3, { catalog_entry_id: 4, starts_on: '2027-01-01', source: 'Cambio' }],
      ],
      [
        'savePreparationDefaults',
        { entityId: 2, data: { expected_version: 0 }, attemptKey: 'k5' },
        'savePreparationDefaults',
        [2, { expected_version: 0 }, 'k5'],
      ],
      [
        'setPaymentForm',
        {
          entityId: 2,
          code: '20',
          enabled: false,
          expectedVersion: 1,
          attemptKey: 'k6',
        },
        'setPaymentForm',
        [2, '20', { enabled: false, expected_version: 1 }, 'k6'],
      ],
      [
        'saveArchivePolicy',
        { fiscal_entity_id: 2 },
        'saveArchivePolicy',
        [{ fiscal_entity_id: 2 }],
        { fiscal_entity_id: 2 },
      ],
      [
        'recordRestoration',
        { fiscal_entity_id: 2 },
        'recordRestoration',
        [{ fiscal_entity_id: 2 }],
      ],
    ]

  it.each(cases)(
    '%s traduce sus variables a la llamada del API',
    async (name, variables, method, args, resolved) => {
      if (resolved) api[method].mockResolvedValue(resolved)
      const { result } = renderHook(() => useFiscalMutations(), {
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
      // react-query añade contexto como último argumento a las funciones que recibe tal cual.
      expect(api[method].mock.calls[0]?.slice(0, args.length)).toEqual(args)
    },
  )

  it('guarda el perfil devuelto y la política en la caché de su emisor', async () => {
    api.saveElectronicProfile.mockResolvedValue({ entity_id: 2, revision: 3 })
    api.saveArchivePolicy.mockResolvedValue({
      fiscal_entity_id: 2,
      ready: true,
    })
    const { result } = renderHook(() => useFiscalMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.saveProfile.mutateAsync({
        entityId: 2,
        data: { expected_revision: 2, conditions: {}, certificate: null },
        attemptKey: 'k7',
      })
      await result.current.saveArchivePolicy.mutateAsync({} as never)
    })
    expect(client.getQueryData(fiscalKeys.profile(2))).toEqual({
      entity_id: 2,
      revision: 3,
    })
    expect(client.getQueryData(fiscalKeys.readiness(2))).toEqual({
      fiscal_entity_id: 2,
      ready: true,
    })
  })
})

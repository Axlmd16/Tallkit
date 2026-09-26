import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  listArchive: vi.fn(),
  getElectronicProfile: vi.fn(),
  listEstablishments: vi.fn(),
  createPreparation: vi.fn(),
  uploadArchive: vi.fn(),
  prepare: vi.fn(),
  saveElectronicProfile: vi.fn(),
  createEstablishment: vi.fn(),
  createPoint: vi.fn(),
  createTaxMapping: vi.fn(),
}))
vi.mock('./api', () => ({ fiscalApi: api }))

import {
  fiscalKeys,
  useArchive,
  useElectronicProfile,
  useEstablishments,
  useFiscalMutations,
} from './hooks'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

let client: QueryClient
beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

describe('fiscal query ownership', () => {
  it('scopes archive and profile keys by issuer', async () => {
    api.listArchive.mockResolvedValue([])
    api.getElectronicProfile.mockResolvedValue({ entity_id: 2, revision: 0 })
    const wrap = { wrapper: wrapper(client) }
    const archive = renderHook(() => useArchive(2), wrap)
    const profile = renderHook(() => useElectronicProfile(2), wrap)
    await waitFor(() => {
      expect(archive.result.current.isSuccess).toBe(true)
      expect(profile.result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData(fiscalKeys.archive(2))).toEqual([])
    expect(client.getQueryData(fiscalKeys.profile(2))).toEqual(
      expect.objectContaining({ entity_id: 2 }),
    )
  })

  it('does not query issuer-owned configuration without a selected issuer', () => {
    renderHook(() => useElectronicProfile(0), { wrapper: wrapper(client) })
    renderHook(() => useEstablishments(0), { wrapper: wrapper(client) })
    expect(api.getElectronicProfile).not.toHaveBeenCalled()
    expect(api.listEstablishments).not.toHaveBeenCalled()
  })

  it('loads establishment keys independently for each issuer', async () => {
    api.listEstablishments.mockResolvedValue([{ id: 4, code: '001' }])
    const result = renderHook(() => useEstablishments(2), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(result.result.current.isSuccess).toBe(true))
    expect(client.getQueryData(fiscalKeys.establishments(2))).toEqual([
      expect.objectContaining({ code: '001' }),
    ])
  })

  it('invalidates only the affected origin and archive issuer after commands', async () => {
    api.createPreparation.mockResolvedValue({ preparation_id: 'p1' })
    api.uploadArchive.mockResolvedValue({ dossier_id: 'd1' })
    client.setQueryData(fiscalKeys.origin('COMMERCIAL', 7), { id: 'old' })
    client.setQueryData(fiscalKeys.origin('ARTISAN', 7), { id: 'other' })
    client.setQueryData(fiscalKeys.archive(2), [])
    const { result } = renderHook(() => useFiscalMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.createPreparation.mutateAsync({
        sourceKind: 'COMMERCIAL',
        sourceId: 7,
        attemptKey: 'a1',
      })
      await result.current.uploadArchive.mutateAsync({
        entityId: 2,
        sourceLabel: 'SRI',
        xml: new File(['x'], 'x.xml'),
      })
    })
    expect(
      client.getQueryState(fiscalKeys.origin('COMMERCIAL', 7))?.isInvalidated,
    ).toBe(true)
    expect(
      client.getQueryState(fiscalKeys.origin('ARTISAN', 7))?.isInvalidated,
    ).toBe(false)
    expect(client.getQueryState(fiscalKeys.archive(2))?.isInvalidated).toBe(
      true,
    )
  })

  it('invalidates only the preparation, profile, locations and tax data changed by commands', async () => {
    api.prepare.mockResolvedValue({ preparation_id: 'p1' })
    api.saveElectronicProfile.mockResolvedValue({
      entity_id: 2,
      revision: 1,
      conditions: {},
      certificate: null,
    })
    api.createEstablishment.mockResolvedValue({ id: 5 })
    api.createPoint.mockResolvedValue({ id: 8 })
    api.createTaxMapping.mockResolvedValue({ id: 9 })
    client.setQueryData(fiscalKeys.preparation('p1'), { version: 1 })
    client.setQueryData(fiscalKeys.establishments(2), [])
    client.setQueryData(['workshop-configuration', 'taxes'], [])

    const { result } = renderHook(() => useFiscalMutations(), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.prepare.mutateAsync({
        preparationId: 'p1',
        reviewToken: 'review',
        attemptKey: 'a2',
      })
      await result.current.saveProfile.mutateAsync({
        entityId: 2,
        data: { expected_revision: 0, conditions: {}, certificate: null },
        attemptKey: 'a3',
      })
      await result.current.createEstablishment.mutateAsync({
        entityId: 2,
        code: '001',
        address: 'Matriz',
      })
      await result.current.createPoint.mutateAsync({
        entityId: 2,
        establishmentId: 5,
        code: '002',
      })
      await result.current.createTaxMapping.mutateAsync({
        definition_id: 3,
        percentage_code: '4',
        starts_on: '2026-01-01',
        source: 'Ficha SRI',
      })
    })

    expect(
      client.getQueryState(fiscalKeys.preparation('p1'))?.isInvalidated,
    ).toBe(true)
    expect(client.getQueryData(fiscalKeys.profile(2))).toEqual(
      expect.objectContaining({ revision: 1 }),
    )
    expect(
      client.getQueryState(fiscalKeys.establishments(2))?.isInvalidated,
    ).toBe(true)
    expect(
      client.getQueryState(['workshop-configuration', 'taxes'])?.isInvalidated,
    ).toBe(true)
    expect(api.createPoint).toHaveBeenCalledWith(5, '002')
  })
})

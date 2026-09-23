import { describe, expect, it, vi } from 'vitest'
import { createWorkshopConfigApi } from '../api'
import type { ApiClient } from '@/shared/api/client'

function setup() {
  const request = vi.fn().mockResolvedValue({})
  const api = createWorkshopConfigApi({ request } as unknown as ApiClient)
  return { api, request }
}

describe('workshopConfigApi', () => {
  it('getStatus calls correct endpoint', async () => {
    const { api, request } = setup()
    request.mockResolvedValueOnce({
      is_initialized: true,
    })

    const res = await api.getStatus()

    expect(request).toHaveBeenCalledWith('/workshop-configuration/status/')
    expect(res.is_initialized).toBe(true)
  })

  it('initialize sends idempotency key', async () => {
    const { api, request } = setup()
    request.mockResolvedValueOnce({ installation_id: 1 })

    const payload = {
      commercial_ruc: '0991234567001',
      commercial_legal_name: 'C',
      artisanal_ruc: '1791234567001',
      artisanal_legal_name: 'A',
      warehouse_name: 'W',
    }
    await api.initialize(payload, 'test-key')
    expect(request).toHaveBeenCalledWith(
      '/workshop-configuration/initialize/',
      {
        method: 'POST',
        body: { ...payload, idempotency_key: 'test-key' },
      },
    )
  })

  it('uses the documented endpoint and payload for every configuration operation', async () => {
    const { api, request } = setup()

    await api.getEntities()
    await api.getEntity(7)
    await api.updateEntity(7, {
      legal_name: 'Entidad actualizada',
      expected_version: 3,
    })
    await api.getWarehouse()
    await api.updateWarehouse({ name: 'Bodega norte', expected_version: 2 })
    await api.getTaxDefinitions()
    await api.getTaxDefinitions(4)
    await api.getAllTaxDefinitions()
    await api.createTaxDefinition({ entity_id: 4, code: 'IVA', name: 'IVA' })
    await api.getTaxPeriods(9)
    await api.createTaxPeriod(9, { rate: '15', starts_on: '2026-09-23' })
    await api.updateTaxPeriod(11, {
      rate: '12',
      expected_version: 5,
    })
    await api.scheduleSuccessor(11, {
      new_rate: '13',
      successor_starts_on: '2026-10-01',
      expected_version: 5,
    })
    await api.getDocumentSeries()
    await api.getDocumentSeries(4)
    await api.getAllSeries()
    await api.getSeries(12)
    await api.updateSeriesCode(12, {
      code: 'COM-NUE',
      expected_version: 1,
    })
    await api.replaceSeries(12, {
      new_code: 'COM-SIG',
      expected_version: 1,
    })

    expect(request.mock.calls).toEqual([
      ['/workshop-configuration/entities/'],
      ['/workshop-configuration/entities/7/'],
      [
        '/workshop-configuration/entities/7/',
        {
          method: 'PATCH',
          body: { legal_name: 'Entidad actualizada', expected_version: 3 },
        },
      ],
      ['/workshop-configuration/warehouse/'],
      [
        '/workshop-configuration/warehouse/',
        {
          method: 'PATCH',
          body: { name: 'Bodega norte', expected_version: 2 },
        },
      ],
      ['/workshop-configuration/taxes/'],
      ['/workshop-configuration/taxes/?entity_id=4'],
      ['/workshop-configuration/taxes/'],
      [
        '/workshop-configuration/taxes/',
        {
          method: 'POST',
          body: { entity_id: 4, code: 'IVA', name: 'IVA' },
        },
      ],
      ['/workshop-configuration/taxes/9/periods/'],
      [
        '/workshop-configuration/taxes/9/periods/',
        { method: 'POST', body: { rate: '15', starts_on: '2026-09-23' } },
      ],
      [
        '/workshop-configuration/periods/11/',
        { method: 'PATCH', body: { rate: '12', expected_version: 5 } },
      ],
      [
        '/workshop-configuration/periods/11/schedule-successor/',
        {
          method: 'POST',
          body: {
            new_rate: '13',
            successor_starts_on: '2026-10-01',
            expected_version: 5,
          },
        },
      ],
      ['/workshop-configuration/series/'],
      ['/workshop-configuration/series/?scope_id=4'],
      ['/workshop-configuration/series/'],
      ['/workshop-configuration/series/12/'],
      [
        '/workshop-configuration/series/12/',
        {
          method: 'PATCH',
          body: { code: 'COM-NUE', expected_version: 1 },
        },
      ],
      [
        '/workshop-configuration/series/12/replace/',
        {
          method: 'POST',
          body: { new_code: 'COM-SIG', expected_version: 1 },
        },
      ],
    ])
  })
})

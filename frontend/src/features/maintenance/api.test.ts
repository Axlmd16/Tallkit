import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createMaintenanceApi } from './api'

function fakeClient() {
  const request = vi.fn().mockResolvedValue({})
  return { client: { request } as unknown as ApiClient, request }
}

describe('maintenanceApi', () => {
  it('lista con búsqueda, estado, fechas e historial en snake_case', async () => {
    const { client, request } = fakeClient()
    await createMaintenanceApi(client).list({
      search: 'abc',
      state: 'FINALIZED',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      vehicleId: 4,
      page: 2,
    })
    expect(request).toHaveBeenCalledWith(
      '/maintenance-orders/?search=abc&state=FINALIZED&date_from=2026-01-01&date_to=2026-01-31&vehicle_id=4&page=2',
    )
  })

  it('las escrituras llevan versión esperada y clave de idempotencia', async () => {
    const { client, request } = fakeClient()
    const api = createMaintenanceApi(client)
    await api.addLine(3, { service_id: 9, applied_price: '10.00' }, 2, 'k-1')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/service-lines/',
      {
        method: 'POST',
        body: {
          service_id: 9,
          applied_price: '10.00',
          expected_version: 2,
          idempotency_key: 'k-1',
        },
      },
    )
    await api.reopen(3, 'Ruido', 5, 'k-2')
    expect(request).toHaveBeenLastCalledWith('/maintenance-orders/3/reopen/', {
      method: 'POST',
      body: { reason: 'Ruido', expected_version: 5, idempotency_key: 'k-2' },
    })
    await api.removeLine(3, 8, 6, 'k-3')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/service-lines/8/remove/',
      { method: 'POST', body: { expected_version: 6, idempotency_key: 'k-3' } },
    )
  })

  it('las fotografías se envían como multipart con descripción y clave', async () => {
    const { client, request } = fakeClient()
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    await createMaintenanceApi(client).uploadPhoto(3, file, 'Golpe', 'k-4')
    const [path, options] = request.mock.lastCall as [
      string,
      { method: string; body: FormData },
    ]
    expect(path).toBe('/maintenance-orders/3/photos/')
    expect(options.body.get('file')).toBe(file)
    expect(options.body.get('description')).toBe('Golpe')
    expect(options.body.get('idempotency_key')).toBe('k-4')
  })

  it('los selectores consultan clientes, vehículos del propietario y servicios', async () => {
    const { client, request } = fakeClient()
    const api = createMaintenanceApi(client)
    await api.vehicleOptions(7)
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/vehicle-options/?customer_id=7',
    )
    await api.serviceOptions('alin', 2)
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/service-options/?search=alin&page=2',
    )
  })

  it('cubre lectura, creación, edición, transiciones y retiro con sus rutas', async () => {
    const { client, request } = fakeClient()
    const api = createMaintenanceApi(client)
    await api.list()
    expect(request).toHaveBeenLastCalledWith('/maintenance-orders/')
    await api.get(3)
    expect(request).toHaveBeenLastCalledWith('/maintenance-orders/3/')
    const data = {
      customer_id: 1,
      vehicle_id: 2,
      opened_on: '2026-09-20',
      odometer_km: 5,
      diagnosis: '',
      notes: '',
    }
    await api.create(data, 'k-a')
    expect(request).toHaveBeenLastCalledWith('/maintenance-orders/', {
      method: 'POST',
      body: { ...data, idempotency_key: 'k-a' },
    })
    await api.update(3, { diagnosis: 'x' }, 2, 'k-b')
    expect(request).toHaveBeenLastCalledWith('/maintenance-orders/3/', {
      method: 'PATCH',
      body: { diagnosis: 'x', expected_version: 2, idempotency_key: 'k-b' },
    })
    await api.updateIntervention(3, { work_performed: 'w' }, 4, 'k-c')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/current-intervention/',
      {
        method: 'PATCH',
        body: {
          work_performed: 'w',
          expected_version: 4,
          idempotency_key: 'k-c',
        },
      },
    )
    await api.updateLine(3, 8, { quantity: 2 }, 5, 'k-d')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/service-lines/8/',
      {
        method: 'PATCH',
        body: { quantity: 2, expected_version: 5, idempotency_key: 'k-d' },
      },
    )
    await api.finalize(3, 6, 'k-e')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/finalize/',
      {
        method: 'POST',
        body: { expected_version: 6, idempotency_key: 'k-e' },
      },
    )
    await api.removePhoto(3, 9, 'k-f')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/3/photos/9/remove/',
      { method: 'POST', body: { idempotency_key: 'k-f' } },
    )
    await api.customerOptions('ana')
    expect(request).toHaveBeenLastCalledWith(
      '/maintenance-orders/customer-options/?search=ana&page=1',
    )
  })
})

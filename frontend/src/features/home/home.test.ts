import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createHomeApi } from './api'
import { fresh, homeKeys } from './hooks'
import {
  pendingTargets,
  qualificationTarget,
  RECEIVABLE_TARGETS,
} from './pendingTargets'
import { QUICK_ACTIONS, visibleQuickActions } from './quickActions'
import type { PendingItem } from './types'

describe('homeApi', () => {
  it('consulta cada bloque en su propia ruta, solo con lectura', async () => {
    const request = vi.fn().mockResolvedValue({})
    const api = createHomeApi({ request } as unknown as ApiClient)
    await api.pending()
    await api.receivables()
    await api.collections()
    expect(request.mock.calls).toEqual([
      ['/home/pending/'],
      ['/home/receivables/'],
      ['/home/collections/'],
    ])
  })

  it('no conserva valores de una visita anterior ni los da por vigentes', () => {
    expect(fresh).toEqual({ gcTime: 0, staleTime: 0 })
  })

  it('cada bloque tiene su propia clave de consulta', () => {
    const keys = [homeKeys.pending, homeKeys.receivables, homeKeys.collections]
    expect(new Set(keys.map((key) => key.join('/'))).size).toBe(3)
    for (const key of keys) expect(key[0]).toBe(homeKeys.root[0])
  })
})

describe('acciones rápidas', () => {
  const labels = (permissions: string[]) =>
    visibleQuickActions(new Set(permissions)).map((action) => action.label)

  it('un Vendedor ve venta, proforma, entrada y cobrar repuestos', () => {
    expect(
      labels([
        'ventas.crear',
        'proformas.gestionar',
        'ingresos.crear',
        'pagos_comerciales.registrar',
      ]),
    ).toEqual([
      'Nueva venta',
      'Nueva proforma',
      'Registrar entrada',
      'Cobrar repuestos',
    ])
  })

  it('un Encargado del taller ve mantenimiento y cobrar servicios', () => {
    expect(
      labels(['mantenimientos.gestionar', 'pagos_artesanales.registrar']),
    ).toEqual(['Nuevo mantenimiento', 'Cobrar servicios'])
  })

  it('quien cobra en las dos entidades tiene un acceso por entidad', () => {
    const charge = visibleQuickActions(
      new Set(['pagos_comerciales.registrar', 'pagos_artesanales.registrar']),
    )
    expect(charge.map((action) => [action.scope, action.to])).toEqual([
      ['commercial', '/sales/receivables'],
      ['artesanal', '/maintenance/receivables'],
    ])
  })

  it('sin permisos no hay acciones y ninguna comparte destino', () => {
    expect(labels([])).toEqual([])
    const destinations = QUICK_ACTIONS.map((action) => action.to)
    expect(new Set(destinations).size).toBe(destinations.length)
  })
})

describe('destinos de los pendientes', () => {
  const item = (
    key: PendingItem['key'],
    scope: PendingItem['scope'],
    count = 1,
  ): PendingItem => ({ key, scope, count })

  it('cada pendiente conduce a su lista con el filtro con que se contó', () => {
    const targets = pendingTargets([
      item('open_orders', null, 4),
      item('cash_sales_unpaid', 'commercial'),
      item('cash_services_unpaid', 'artisan'),
      item('proformas_expiring', 'commercial'),
      item('sale_drafts', 'commercial'),
      item('proforma_drafts', 'commercial'),
    ])
    expect(targets.map((target) => target.to)).toEqual([
      '/maintenance?state=OPEN',
      '/sales/receivables?condition=CONTADO&only_debt=true',
      '/maintenance/receivables?condition=CONTADO',
      '/proformas?state=VALID&expires_within_days=1',
      '/sales?state=DRAFT',
      '/proformas?state=DRAFT',
    ])
    expect(targets[0]).toMatchObject({
      label: 'Mantenimientos abiertos',
      count: 4,
      scope: undefined,
    })
    expect(targets[2]?.scope).toBe('artesanal')
  })

  it('las retenciones se separan por entidad fiscal', () => {
    const targets = pendingTargets([
      item('withholdings_pending', 'commercial', 2),
      item('withholdings_pending', 'artisan', 1),
    ])
    expect(targets.map((target) => [target.scope, target.to])).toEqual([
      ['commercial', '/sales/withholdings'],
      ['artesanal', '/maintenance/withholdings'],
    ])
    expect(new Set(targets.map((target) => target.id)).size).toBe(2)
  })

  it('un pendiente desconocido se omite en lugar de inventarse', () => {
    const unknown = { key: 'low_stock', scope: null, count: 9 } as never
    expect(pendingTargets([unknown])).toEqual([])
  })

  it('por cobrar y la calificación tienen su destino', () => {
    expect(RECEIVABLE_TARGETS.commercial.to).toBe('/sales/receivables')
    expect(RECEIVABLE_TARGETS.artisan.to).toBe('/maintenance/receivables')
    expect(qualificationTarget(7)).toBe(
      '/configuration?tab=facturacion&entidad=7',
    )
  })
})

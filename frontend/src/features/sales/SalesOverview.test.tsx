import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  enabled: {} as Record<string, boolean>,
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/maintenance/OrderForm', () => ({
  businessToday: () => '2026-11-15',
}))
vi.mock('@/features/home/hooks', () => ({
  useHomeCollections: (enabled: boolean) => {
    mocks.enabled.collections = enabled
    return {
      data: {
        timezone: 'America/Guayaquil',
        items: [
          {
            scope: 'artisan',
            total: '90.00',
            days: [{ date: '2026-11-15', amount: '90.00' }],
          },
          {
            scope: 'commercial',
            total: '35.00',
            days: [{ date: '2026-11-15', amount: '35.00' }],
          },
        ],
      },
    }
  },
  useHomeReceivables: (enabled: boolean) => {
    mocks.enabled.receivables = enabled
    return {
      data: {
        items: [
          { scope: 'artisan', balance: '500.00', customers: 4 },
          { scope: 'commercial', balance: '58.00', customers: 2 },
        ],
      },
    }
  },
}))
vi.mock('@/features/proformas/hooks', () => ({
  useProformas: () => ({ data: { count: 3 } }),
}))
vi.mock('./hooks', () => ({
  useSales: () => ({ data: { count: 7 } }),
}))

import { SalesOverview } from './SalesOverview'

function renderOverview() {
  return render(
    <MemoryRouter>
      <SalesOverview />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.enabled = {}
  mocks.permissions = ['ventas.ver', 'proformas.ver', 'pagos_comerciales.ver']
})

it('muestra solo los importes del negocio de repuestos, nunca los del taller ni un total', () => {
  renderOverview()
  expect(screen.getByText('USD 35.00')).toBeInTheDocument()
  expect(screen.getByText('USD 58.00')).toBeInTheDocument()
  expect(screen.queryByText(/90\.00|500\.00|125\.00|558\.00/)).toBeNull()
  expect(screen.getByText('7')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
})

it('sin permiso de cobros no pide ni muestra importes', () => {
  mocks.permissions = ['ventas.ver', 'proformas.ver']
  renderOverview()
  expect(mocks.enabled).toEqual({ collections: false, receivables: false })
  expect(screen.queryByText('Cobrado hoy')).toBeNull()
  expect(screen.queryByText('Quedaron debiendo')).toBeNull()
  expect(screen.getByText('Ventas de hoy')).toBeInTheDocument()
})

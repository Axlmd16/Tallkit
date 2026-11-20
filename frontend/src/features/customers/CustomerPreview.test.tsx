import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  summary: {} as Record<string, unknown>,
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('./hooks', () => ({
  useCustomer: () => ({
    isPending: false,
    data: {
      id: 3,
      name: 'Carlos Mendoza',
      person_type: 'NATURAL',
      identification_type: 'CI',
      identification: '0912345678',
      phone: '099 123 4567',
      email: 'cmendoza@correo.com',
      is_active: true,
      created_at: '2024-03-02T00:00:00Z',
    },
  }),
}))
vi.mock('./accounts', () => ({
  useCustomerAccountSummary: () => ({ data: mocks.summary }),
}))
vi.mock('@/features/vehicles/hooks', () => ({
  useCustomerVehicles: () => ({
    isPending: false,
    data: {
      results: [
        {
          id: 9,
          plate: 'GBA-1234',
          model: 'Aveo',
          year: 2016,
          brand: { name: 'Chevrolet' },
        },
      ],
    },
  }),
}))
vi.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceOrders: () => ({ isPending: false, data: { results: [] } }),
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useIssuerBrand: (scope: string) => ({
    logoUrl: null,
    legalName: undefined,
    displayName: scope === 'ARTESANAL' ? 'Taller' : 'Almacén',
  }),
}))

import { CustomerPreview } from './CustomerPreview'

function renderPreview() {
  return render(
    <MemoryRouter>
      <CustomerPreview customerId={3} onNewMaintenance={vi.fn()} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.permissions = [
    'clientes.ver',
    'ventas.crear',
    'mantenimientos.ver',
    'pagos_comerciales.ver',
    'pagos_artesanales.ver',
  ]
  mocks.summary = {
    visits: { count_year: 4, last_on: '2026-11-15' },
    commercial: {
      spent_year: '40.00',
      documents_year: 1,
      last_on: null,
      balance: '18.00',
    },
    artisan: {
      spent_year: '60.00',
      documents_year: 1,
      last_on: null,
      balance: '45.00',
    },
  }
})

it('muestra lo gastado y lo que debe en cada negocio, sin sumar', () => {
  renderPreview()
  for (const amount of ['40.00', '60.00', '18.00', '45.00'])
    expect(screen.getAllByText(`USD ${amount}`).length).toBeGreaterThan(0)
  expect(document.body.textContent).not.toMatch(/100\.00|63\.00/)
  expect(screen.getByText('GBA-1234')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Registrar pago' }),
  ).toBeInTheDocument()
})

it('sin deuda no ofrece «Registrar pago»', () => {
  mocks.summary = {
    visits: null,
    commercial: {
      spent_year: '0.00',
      documents_year: 0,
      last_on: null,
      balance: '0.00',
    },
    artisan: null,
  }
  renderPreview()
  expect(screen.queryByRole('link', { name: 'Registrar pago' })).toBeNull()
})

it('sin permiso de cobros el servidor no entrega importes y no se muestran', () => {
  mocks.permissions = ['clientes.ver']
  mocks.summary = { visits: null, commercial: null, artisan: null }
  renderPreview()
  expect(screen.queryByText('Este año')).toBeNull()
  expect(screen.queryByText('Debe')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Venta rápida' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Nuevo mantenimiento' }),
  ).not.toBeNull()
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { username: 'ana' } }),
}))
vi.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceOrder: () => ({
    isPending: false,
    isError: false,
    data: {
      id: 9,
      number: 'ART-OT-000009',
      customer: { name: 'Ana Pérez' },
      vehicle: { plate: 'ABC-1234' },
    },
  }),
}))
vi.mock('@/features/maintenance/EconomicSummary', () => ({
  EconomicSummary: () => <p>Resumen económico por negocio</p>,
}))

import { MaintenanceBillingPage } from './MaintenanceBillingPage'

it('muestra los cobros de cada negocio y vuelve al mantenimiento', () => {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/maintenance/9/billing']}>
        <Routes>
          <Route
            element={<MaintenanceBillingPage />}
            path="/maintenance/:id/billing"
          />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
  expect(
    screen.getByRole('heading', { name: 'Cobrar y facturar' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Resumen económico por negocio')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /Volver al mantenimiento/ }),
  ).toHaveAttribute('href', '/maintenance/9')
})

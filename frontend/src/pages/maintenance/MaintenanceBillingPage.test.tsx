import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  order: {
    isPending: false,
    isError: false,
    data: undefined as unknown,
    refetch: vi.fn(),
  },
  session: { data: { username: 'admin' } },
}))

vi.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceOrder: () => mocks.order,
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => mocks.session,
}))

vi.mock('@/features/maintenance/EconomicSummary', () => ({
  EconomicSummary: ({ onDone }: { onDone: (message: string) => void }) => (
    <button onClick={() => onDone('Cobro registrado')} type="button">
      Simular cobro
    </button>
  ),
}))

import { ToastProvider } from '@/shared/ui'

import { MaintenanceBillingPage } from './MaintenanceBillingPage'

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/maintenance/9/billing']}>
          <Routes>
            <Route
              element={<MaintenanceBillingPage />}
              path="/maintenance/:id/billing"
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.order = {
    isPending: false,
    isError: false,
    data: undefined,
    refetch: vi.fn(),
  }
})

describe('MaintenanceBillingPage', () => {
  it('muestra carga, error con reintento y el resumen económico de la orden', async () => {
    const user = userEvent.setup()

    mocks.order = {
      isPending: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    }
    const first = renderPage()
    expect(screen.getByText(/Cargando orden/)).toBeInTheDocument()
    first.unmount()

    const refetch = vi.fn()
    mocks.order = { isPending: false, isError: true, data: undefined, refetch }
    const second = renderPage()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(refetch).toHaveBeenCalledTimes(1)
    second.unmount()

    mocks.order = {
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      data: {
        id: 9,
        number: 'ART-OT-000009',
        customer: { id: 1, name: 'Ana Pérez' },
        vehicle: { plate: 'ABC-1234' },
      },
    }
    renderPage()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('ABC-1234')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Simular cobro' }))
    expect(screen.getByText('Cobro registrado')).toBeInTheDocument()
  })
})

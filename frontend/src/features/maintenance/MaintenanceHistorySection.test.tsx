import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: {} as Record<string, unknown>,
  args: [] as unknown[],
}))
vi.mock('./hooks', () => ({
  useMaintenanceOrders: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.list
  },
}))

vi.mock('@/features/maintenance/NewMaintenanceDialog', () => ({
  NewMaintenanceDialog: ({ initialSearch }: { initialSearch?: string }) => (
    <div role="dialog" aria-label="Nuevo mantenimiento">
      {initialSearch ?? ''}
    </div>
  ),
}))

import { MaintenanceHistorySection } from './MaintenanceHistorySection'

const item = {
  id: 7,
  number: 'ART-OT-000007',
  state: 'FINALIZED',
  opened_on: '2026-09-20',
  odometer_km: 1,
  customer: { id: 3, name: 'Ana Pérez', identification: '1', is_active: false },
  vehicle: {
    id: 4,
    plate: 'ABC-1234',
    brand: 'T',
    model: 'H',
    is_active: true,
  },
  services_total: '45.00',
  service_summary: {
    names: ['Alineación', 'Balanceo', 'Lavado'],
    line_count: 5,
  },
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderSection(props: Parameters<typeof MaintenanceHistorySection>[0]) {
  return render(
    <MemoryRouter initialEntries={['/customers/3']}>
      <Routes>
        <Route
          element={<MaintenanceHistorySection {...props} />}
          path="/customers/:id"
        />
        <Route element={<Where />} path="/maintenance/*" />
      </Routes>
    </MemoryRouter>,
  )
}

function page(results: unknown[]) {
  return {
    isPending: false,
    isError: false,
    data: {
      count: results.length,
      page: 1,
      page_size: 10,
      total_pages: 1,
      results,
    },
  }
}

beforeEach(() => {
  mocks.args.length = 0
  mocks.list = page([item])
})

it('lista fecha, número, estado, resumen y total con enlace al detalle', async () => {
  const user = userEvent.setup()
  renderSection({ customer: { id: 3, name: 'Ana Pérez' }, canCreate: false })
  expect(mocks.args.at(-1)).toMatchObject({ customerId: 3, page: 1 })
  expect(screen.getByText('20/09/2026')).toBeInTheDocument()
  expect(
    screen.getByText(/Alineación, Balanceo, Lavado y 2 más/),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Estado: Finalizada')).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'ART-OT-000007' }))
  expect(screen.getByTestId('where')).toHaveTextContent('/maintenance/7')
})

it('el historial del vehículo filtra por vehículo e incluye a cada cliente', () => {
  renderSection({ vehicleId: 4, canCreate: false })
  expect(mocks.args.at(-1)).toMatchObject({
    vehicleId: 4,
    customerId: undefined,
  })
  expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument()
})

it('abre el alta con el cliente de la ficha solo a quien gestiona', async () => {
  const user = userEvent.setup()
  renderSection({
    customer: { id: 3, name: 'Ana' },
    vehicleId: 4,
    canCreate: true,
  })
  await user.click(screen.getByRole('button', { name: /Nueva orden/ }))
  expect(
    screen.getByRole('dialog', { name: 'Nuevo mantenimiento' }),
  ).toHaveTextContent('Ana')
})

it('muestra un estado vacío', () => {
  mocks.list = page([])
  renderSection({ customer: { id: 3, name: 'Ana' }, canCreate: false })
  expect(
    screen.getByText('No hay órdenes de mantenimiento registradas.'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /Nueva orden/ }),
  ).not.toBeInTheDocument()
})

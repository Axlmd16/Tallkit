import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  list: {} as Record<string, unknown>,
  args: [] as unknown[],
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/maintenance/hooks', () => ({
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

import { MaintenanceOrdersPage } from './MaintenanceOrdersPage'

const item = {
  id: 7,
  number: 'ART-OT-000007',
  state: 'FINALIZED',
  opened_on: '2026-09-20',
  odometer_km: 85000,
  customer: {
    id: 3,
    name: 'Ana Pérez',
    identification: '171',
    is_active: true,
  },
  vehicle: {
    id: 4,
    plate: 'ABC-1234',
    brand: 'Toyota',
    model: 'Hilux',
    is_active: true,
  },
  services_total: '120.00',
  service_summary: { names: ['Alineación'], line_count: 1 },
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderPage(path = '/maintenance') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <>
              <MaintenanceOrdersPage />
              <Where />
            </>
          }
          path="/maintenance"
        />
        <Route element={<Where />} path="/maintenance/:id" />
        <Route element={<Where />} path="/maintenance/new" />
        <Route element={<Where />} path="/maintenance/:id/edit" />
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
      page_size: 20,
      total_pages: 1,
      results,
    },
  }
}

beforeEach(() => {
  mocks.args.length = 0
  mocks.permissions = ['mantenimientos.ver', 'mantenimientos.gestionar']
  mocks.list = page([item])
})

it('muestra número, cliente, placa, estado y total de servicios', () => {
  renderPage()
  expect(screen.getAllByText('ART-OT-000007').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Ana Pérez').length).toBeGreaterThan(0)
  expect(screen.getAllByText('ABC-1234').length).toBeGreaterThan(0)
  expect(screen.getAllByLabelText('Estado: Finalizada').length).toBeGreaterThan(
    0,
  )
  expect(screen.getAllByText(/120\.00/).length).toBeGreaterThan(0)
})

it('filtra por búsqueda, estado y fechas desde la URL', () => {
  renderPage(
    '/maintenance?search=abc&state=REOPENED&date_from=2026-01-01&date_to=2026-01-31',
  )
  expect(mocks.args.at(-1)).toEqual({
    search: 'abc',
    state: 'REOPENED',
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    page: 1,
  })
})

it('ofrece abrir el alta solo a quien gestiona', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: /Nueva orden/ }))
  expect(
    screen.getByRole('dialog', { name: 'Nuevo mantenimiento' }),
  ).toBeVisible()
})

it('oculta la creación sin permiso de gestión', () => {
  mocks.permissions = ['mantenimientos.ver']
  renderPage()
  expect(
    screen.queryByRole('button', { name: /Nueva orden/ }),
  ).not.toBeInTheDocument()
})

it('muestra un estado vacío explicativo', () => {
  mocks.list = page([])
  renderPage()
  expect(screen.getByText('No hay órdenes')).toBeInTheDocument()
})

it('muestra el error de carga', () => {
  mocks.list = { isPending: false, isError: true, refetch: vi.fn() }
  renderPage()
  expect(
    screen.getByText(/No fue posible consultar las órdenes/),
  ).toBeInTheDocument()
})

it('abre el detalle desde la fila y ofrece editar solo órdenes registradas', async () => {
  const user = userEvent.setup()
  mocks.list = page([{ ...item, state: 'REGISTERED' }])
  renderPage('/maintenance?search=abc')
  await user.click(
    screen.getAllByRole('button', { name: 'Acciones de ART-OT-000007' })[0]!,
  )
  await user.click(
    await screen.findByRole('menuitem', { name: /Editar orden/ }),
  )
  expect(screen.getByTestId('where')).toHaveTextContent('/maintenance/7/edit')
})

it('cambia filtros de fecha y los limpia', async () => {
  const user = userEvent.setup()
  renderPage('/maintenance?state=FINALIZED')
  await user.type(screen.getByLabelText('Apertura desde'), '2026-01-01')
  expect(screen.getByTestId('where')).toHaveTextContent('date_from=2026-01-01')
  await user.click(screen.getByRole('button', { name: /Limpiar/ }))
  expect(screen.getByTestId('where')).toHaveTextContent(/^\/maintenance$/)
})

it('«Abiertas» reúne registradas y reabiertas y llega filtrada desde el inicio', () => {
  renderPage('/maintenance?state=OPEN')
  expect(mocks.args.at(-1)).toMatchObject({ state: 'OPEN' })
  expect(screen.getByRole('radio', { name: 'Abiertas' })).toBeChecked()
})

it('los segmentos Todas, Abiertas y Finalizadas muestran el contador del servidor y filtran por estado', async () => {
  mocks.list = {
    ...page([item]),
    data: {
      ...page([item]).data,
      status_counts: { all: 9, open: 4, finalized: 5 },
    },
  }
  const user = userEvent.setup()
  renderPage()

  const segments = screen.getAllByRole('radio')
  expect(segments).toHaveLength(3)
  const group = screen.getByRole('radiogroup', { name: 'Estado de la orden' })
  expect(group).toHaveTextContent('Todas9')
  expect(group).toHaveTextContent('Abiertas4')
  expect(group).toHaveTextContent('Finalizadas5')

  await user.click(screen.getByRole('radio', { name: /Finalizadas/ }))
  expect(screen.getByTestId('where')).toHaveTextContent('state=FINALIZED')
})

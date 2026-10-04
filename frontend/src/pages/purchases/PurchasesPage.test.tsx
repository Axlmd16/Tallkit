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
vi.mock('@/features/purchases/hooks', () => ({
  usePurchases: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.list
  },
}))

import { PurchasesPage } from './PurchasesPage'

const summary = {
  id: 7,
  flow: 'SIMPLE',
  state: 'CONFIRMED',
  internal_number: 'COM-ING-000007',
  moment: '2026-10-04T15:30:00-05:00',
  registered_by: { id: 3, name: 'Laura Vendedora' },
  product_count: 3,
  unit_count: '10',
  supplier: { id: 1, name: 'Repuestos SA' },
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderPage(path = '/purchases') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <>
              <PurchasesPage />
              <Where />
            </>
          }
          path="/purchases"
        />
        <Route element={<Where />} path="/purchases/:id" />
        <Route element={<Where />} path="/purchases/new" />
      </Routes>
    </MemoryRouter>,
  )
}

const page = (people = [{ id: 3, name: 'Laura Vendedora' }]) => ({
  isPending: false,
  isError: false,
  data: {
    count: 1,
    page: 1,
    page_size: 20,
    total_pages: 1,
    results: [summary],
    registered_by_options: people,
  },
})

beforeEach(() => {
  mocks.args.length = 0
  mocks.permissions = ['ingresos.ver', 'ingresos.crear']
  mocks.list = page()
})

it('muestra número, momento, usuario, contenido y estado, sin importes', () => {
  renderPage()
  expect(screen.getAllByText('COM-ING-000007').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Laura Vendedora').length).toBeGreaterThan(0)
  expect(
    screen.getAllByText('3 productos · 10 unidades').length,
  ).toBeGreaterThan(0)
  expect(screen.getAllByText('Registrada').length).toBeGreaterThan(0)
  expect(screen.queryByText(/USD|total/i)).toBeNull()
  expect(
    screen.getByRole('heading', { name: 'Entradas de stock' }),
  ).toBeInTheDocument()
})

it('filtra por estado con los segmentos de la lista', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('radio', { name: 'Anuladas' }))
  expect(screen.getByTestId('where')).toHaveTextContent('state=VOIDED')
})

it('los borradores del flujo anterior solo se ofrecen a quien ve costos', () => {
  renderPage()
  expect(screen.queryByRole('radio', { name: 'Sin efecto' })).toBeNull()
  mocks.permissions = ['ingresos.ver', 'productos.ver_costos']
  renderPage()
  expect(screen.getByRole('radio', { name: 'Sin efecto' })).toBeInTheDocument()
})

it('lee estado, período, usuario y página de la dirección', () => {
  renderPage(
    '/purchases?state=VOIDED&date_from=2026-01-01&date_to=2026-01-31&registered_by=3&page=2',
  )
  expect(mocks.args.at(-1)).toMatchObject({
    state: 'VOIDED',
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    registeredBy: 3,
    page: 2,
  })
})

it('el filtro por usuario aparece solo si hay más de uno que haya registrado', async () => {
  renderPage()
  expect(screen.queryByLabelText('Registró')).toBeNull()
  mocks.list = page([
    { id: 3, name: 'Laura Vendedora' },
    { id: 1, name: 'Admin' },
  ])
  renderPage()
  await userEvent.selectOptions(screen.getByLabelText('Registró'), '1')
  expect(screen.getAllByTestId('where').at(-1)).toHaveTextContent(
    'registered_by=1',
  )
})

it('abre la ficha completa al seleccionar una fila y recuerda de dónde vino', async () => {
  renderPage('/purchases?state=CONFIRMED')
  await userEvent.click(screen.getAllByText('COM-ING-000007')[0]!)
  expect(screen.getByTestId('where')).toHaveTextContent('/purchases/7')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('solo ofrece registrar con el permiso correspondiente', () => {
  mocks.permissions = ['ingresos.ver']
  renderPage()
  expect(screen.queryByRole('button', { name: /nueva entrada/i })).toBeNull()
})

it('el botón de registrar lleva al formulario', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /nueva entrada/i }))
  expect(screen.getByTestId('where')).toHaveTextContent('/purchases/new')
})

it('presenta estados de carga, error recuperable y vacío sin entradas ficticias', () => {
  mocks.list = { isPending: true, isError: false }
  const { unmount } = renderPage()
  expect(screen.getByText('Cargando entradas…')).toBeInTheDocument()
  unmount()
  mocks.list = { isPending: false, isError: true, refetch: vi.fn() }
  const second = renderPage()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No fue posible consultar',
  )
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  second.unmount()
  mocks.list = {
    isPending: false,
    isError: false,
    data: {
      count: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
      results: [],
      registered_by_options: [],
    },
  }
  renderPage()
  expect(screen.getByText('No hay entradas')).toBeInTheDocument()
})

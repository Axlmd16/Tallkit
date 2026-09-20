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
  state: 'CONFIRMED',
  version: 2,
  internal_number: 'COM-ING-000007',
  supplier: { id: 1, name: 'Repuestos SA' },
  document: { type: 'FACTURA', reference: '001-001-123' },
  document_date: '2026-01-15',
  total: '22.00',
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

beforeEach(() => {
  mocks.args.length = 0
  mocks.permissions = ['ingresos.ver', 'ingresos.crear']
  mocks.list = {
    isPending: false,
    isError: false,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [summary],
    },
  }
})

it('muestra fechas, estado, ámbito fiscal y totales tal como los entrega el backend', () => {
  renderPage()
  expect(screen.getAllByText('COM-ING-000007').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Repuestos SA').length).toBeGreaterThan(0)
  expect(screen.getAllByText('15/01/2026').length).toBeGreaterThan(0)
  expect(screen.getAllByText('USD 22.00').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Confirmado').length).toBeGreaterThan(0)
  expect(screen.getByText('RUC comercial')).toBeInTheDocument()
})

it('los filtros de proveedor, estado y período se leen de la dirección', () => {
  renderPage(
    '/purchases?state=VOIDED&supplier_id=4&date_from=2026-01-01&date_to=2026-01-31&page=2',
  )
  expect(mocks.args.at(-1)).toMatchObject({
    state: 'VOIDED',
    supplierId: 4,
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    page: 2,
  })
})

it('abre una vista previa y conserva la ruta de la ficha completa', async () => {
  renderPage('/purchases?state=CONFIRMED')
  await userEvent.click(screen.getAllByText('COM-ING-000007')[0]!)
  const preview = await screen.findByRole('dialog', {
    name: 'Detalle del ingreso',
  })
  expect(screen.getByTestId('where')).toHaveTextContent('/purchases')
  expect(preview.querySelector('a[href="/purchases/7"]')).toBeInTheDocument()
})

it('solo ofrece crear con el permiso correspondiente', () => {
  mocks.permissions = ['ingresos.ver']
  renderPage()
  expect(screen.queryByRole('button', { name: /nuevo ingreso/i })).toBeNull()
})

it('presenta estados de carga, error recuperable y vacío sin ingresos ficticios', async () => {
  mocks.list = { isPending: true, isError: false }
  const { unmount } = renderPage()
  expect(screen.getByText('Cargando ingresos…')).toBeInTheDocument()
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
    data: { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] },
  }
  renderPage()
  expect(screen.getByText('No hay ingresos')).toBeInTheDocument()
})

import { render, screen, within } from '@testing-library/react'
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
vi.mock('@/features/sales/hooks', () => ({
  useSales: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.list
  },
}))
vi.mock('@/features/sales/pickers', () => ({
  useCustomerPickerOptions: () => ({
    isPending: false,
    isError: false,
    data: { totalPages: 1, options: [{ id: 3, label: 'Ana Pérez' }] },
  }),
}))

import { SalesPage } from './SalesPage'

const summary = {
  id: 7,
  state: 'CONFIRMED',
  version: 2,
  internal_number: 'COM-VEN-000007',
  customer: { id: 3, name: 'Ana Pérez' },
  origin: { type: 'DIRECT', order_id: null, order_number: null },
  sale_date: '2026-09-20',
  condition: 'CREDITO',
  grand_total: '23.00',
  money: { payment_state: 'PARTIAL', balance: '13.00', refund_due: '0.00' },
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderPage(path = '/sales') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <>
              <SalesPage />
              <Where />
            </>
          }
          path="/sales"
        />
        <Route element={<Where />} path="/sales/:id" />
        <Route element={<Where />} path="/sales/new" />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.args.length = 0
  mocks.permissions = ['ventas.ver', 'ventas.crear']
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

it('muestra número, cliente, origen, fecha, total y estados de venta y de pago por separado', () => {
  renderPage()
  expect(screen.getAllByText('COM-VEN-000007').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Ana Pérez').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Directa').length).toBeGreaterThan(0)
  expect(screen.getByLabelText('Origen')).toHaveValue('')
  expect(
    within(screen.getByRole('table', { name: 'Ventas' }))
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual([
    'Número',
    'Fecha',
    'Origen',
    'Cliente',
    'Condición',
    'Estado',
    'Pago',
    'Total USD',
    'Acciones',
  ])
  expect(screen.getAllByText('20/09/2026').length).toBeGreaterThan(0)
  expect(screen.getAllByText('USD 23.00').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Confirmada').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Parcial').length).toBeGreaterThan(0)
  // El ámbito fiscal lo muestra la barra superior del marco; la página no lo duplica.
  expect(screen.queryByText('Negocio: Repuestos')).toBeNull()
})

it('el número interno usa cifras de ancho uniforme y el total se alinea a la derecha', () => {
  renderPage()
  const table = screen.getByRole('table', { name: 'Ventas' })
  expect(within(table).getByText('COM-VEN-000007')).toHaveClass('code')
  expect(within(table).getByText('USD 23.00').closest('td')).toHaveClass(
    'text-right',
  )
})

it('los filtros de cliente, estado, pago y período se leen de la dirección', () => {
  renderPage(
    '/sales?state=VOIDED&customer_id=4&payment_state=PAID&date_from=2026-01-01&date_to=2026-01-31&page=2',
  )
  expect(mocks.args.at(-1)).toMatchObject({
    state: 'VOIDED',
    customerId: 4,
    paymentState: 'PAID',
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    page: 2,
  })
})

it('conserva los filtros al abrir el detalle', async () => {
  renderPage('/sales?state=CONFIRMED&page=1')
  await userEvent.click(screen.getAllByText('COM-VEN-000007')[0]!)
  expect(screen.getByTestId('where').textContent).toBe('/sales/7')
})

it('solo ofrece crear con el permiso correspondiente', () => {
  mocks.permissions = ['ventas.ver']
  renderPage()
  expect(screen.queryByRole('button', { name: /nueva venta/i })).toBeNull()
})

it('presenta estados de carga, error recuperable y vacío sin ventas ficticias', () => {
  mocks.list = { isPending: true, isError: false }
  const first = renderPage()
  expect(screen.getByText('Cargando ventas…')).toBeInTheDocument()
  first.unmount()
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
  expect(screen.getByText('No hay ventas')).toBeInTheDocument()
})

it('no solicita ni muestra costos en la lista', () => {
  renderPage()
  expect(document.body.textContent?.toLowerCase()).not.toContain('costo')
  expect(JSON.stringify(mocks.args)).not.toContain('cost')
})

it('los filtros escriben en la dirección y «Limpiar» los retira', async () => {
  renderPage(
    '/sales?state=CONFIRMED&payment_state=PAID&date_from=2026-01-01&date_to=2026-01-31&customer_id=3&customer_name=Ana',
  )
  await userEvent.click(
    within(
      screen.getByRole('radiogroup', { name: 'Estado de la venta' }),
    ).getByRole('radio', { name: 'Anuladas' }),
  )
  await userEvent.selectOptions(
    screen.getByLabelText('Estado de pago'),
    'PENDING',
  )
  const from = screen.getByLabelText('Fecha desde')
  await userEvent.clear(from)
  await userEvent.type(from, '2026-02-01')
  expect(mocks.args.at(-1)).toMatchObject({
    state: 'VOIDED',
    paymentState: 'PENDING',
  })
  await userEvent.click(screen.getByRole('button', { name: /Limpiar/i }))
  expect(mocks.args.at(-1)).toMatchObject({ page: 1 })
  expect((mocks.args.at(-1) as { state?: string }).state).toBeUndefined()
})

it('elegir un cliente lo lleva a la dirección y crear abre el editor', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('combobox', { name: 'Cliente' }))
  await userEvent.click(
    await screen.findByRole('option', { name: /Ana Pérez/ }),
  )
  expect((mocks.args.at(-1) as { customerId?: number }).customerId).toBe(3)
  await userEvent.click(screen.getByRole('button', { name: /nueva venta/i }))
  expect(screen.getByTestId('where')).toHaveTextContent('/sales/new')
})

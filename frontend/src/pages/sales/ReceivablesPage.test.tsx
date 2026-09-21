import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  args: [] as unknown[],
}))
vi.mock('@/features/sales/hooks', () => ({
  useReceivables: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.data
  },
}))
vi.mock('@/features/sales/pickers', () => ({
  useCustomerPickerOptions: () => ({
    isPending: false,
    isError: false,
    data: { totalPages: 1, options: [] },
  }),
}))

import { ReceivablesPage } from './ReceivablesPage'

const row = (id: number, balance: string, refund: string, age: number) => ({
  id,
  state: 'CONFIRMED',
  internal_number: `COM-VEN-00000${id}`,
  customer: { id: 1, name: 'Ana' },
  sale_date: '2026-09-10',
  age_days: age,
  money: { balance, refund_due: refund, payment_state: 'PENDING' },
})

beforeEach(() => {
  mocks.args.length = 0
  mocks.data = {
    isPending: false,
    isError: false,
    data: {
      count: 12,
      page: 1,
      page_size: 20,
      total_pages: 1,
      receivable_total: '40.00',
      refund_due_total: '20.00',
      results: [row(1, '40.00', '0.00', 10), row(2, '0.00', '20.00', 3)],
    },
  }
})

function renderPage(path = '/sales/receivables') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ReceivablesPage />
    </MemoryRouter>,
  )
}

it('separa deuda cobrable y reembolso pendiente en totales y columnas, sin restarlos', () => {
  renderPage()
  const totals = screen.getByRole('region', {
    name: 'Totales de todas las coincidencias',
  })
  expect(totals).toHaveTextContent('USD 40.00')
  expect(totals).toHaveTextContent('USD 20.00')
  expect(totals).toHaveTextContent(
    'en 12 ventas (todas las coincidencias, no solo esta página)',
  )
  expect(totals).toHaveTextContent(
    'No se resta de la deuda ni es saldo a favor',
  )
  expect(screen.getAllByText('Deuda cobrable').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Reembolso pendiente').length).toBeGreaterThan(0)
  expect(document.body).not.toHaveTextContent('USD 20.00 de deuda neta')
})

it('muestra la antigüedad en días sin etiquetas de mora ni vencimiento', () => {
  renderPage()
  expect(screen.getAllByText('10 días').length).toBeGreaterThan(0)
  expect(document.body.textContent).not.toMatch(
    /mora|moroso|vencid|recargo|vencimiento/i,
  )
})

it('los filtros de estado y antigüedad viajan a la consulta desde la URL', () => {
  renderPage(
    '/sales/receivables?payment_state=PARTIAL&min_age_days=10&customer_id=3',
  )
  expect(mocks.args.at(-1)).toMatchObject({
    paymentState: 'PARTIAL',
    minAgeDays: 10,
    customerId: 3,
  })
})

it('presenta carga, error y vacío', () => {
  mocks.data = { isPending: true, isError: false }
  const a = renderPage()
  expect(screen.getByText('Cargando cuentas por cobrar…')).toBeInTheDocument()
  a.unmount()
  mocks.data = { isPending: false, isError: true, refetch: vi.fn() }
  const b = renderPage()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No fue posible consultar',
  )
  b.unmount()
  mocks.data = {
    isPending: false,
    isError: false,
    data: {
      count: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
      results: [],
      receivable_total: '0.00',
      refund_due_total: '0.00',
    },
  }
  renderPage()
  expect(screen.getByText('Sin cuentas por cobrar')).toBeInTheDocument()
})

it('los filtros de estado y antigüedad actualizan la consulta y se pueden limpiar', async () => {
  const { default: userEvent } = await import('@testing-library/user-event')
  renderPage('/sales/receivables?payment_state=PARTIAL&min_age_days=5')
  await userEvent.selectOptions(
    screen.getByLabelText('Estado de pago'),
    'PENDING',
  )
  expect(mocks.args.at(-1)).toMatchObject({ paymentState: 'PENDING' })
  const age = screen.getByLabelText('Antigüedad mínima (días)')
  await userEvent.clear(age)
  await userEvent.type(age, '30')
  expect(mocks.args.at(-1)).toMatchObject({ minAgeDays: 30 })
  await userEvent.click(screen.getByRole('button', { name: /Limpiar/i }))
  expect(
    (mocks.args.at(-1) as { paymentState?: string }).paymentState,
  ).toBeUndefined()
})

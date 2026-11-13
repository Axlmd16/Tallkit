import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
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
    data: { totalPages: 1, options: [] },
  }),
}))

import { SaleOriginLabel } from '@/features/sales/format'

import { SalesPage } from './SalesPage'

const summary = (origin: Record<string, unknown>) => ({
  id: 7,
  state: 'DRAFT',
  version: 1,
  internal_number: null,
  customer: { id: 3, name: 'Ana Pérez' },
  origin,
  sale_date: '2026-10-07',
  condition: 'CONTADO',
  grand_total: null,
  money: { payment_state: null },
})

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<SalesPage />} path="/sales" />
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
      results: [
        summary({
          type: 'PROFORMA',
          order_id: null,
          order_number: null,
          proforma_id: 4,
          proforma_number: 'COM-PRO-000004',
        }),
      ],
    },
  }
})

it('la lista de ventas filtra por origen proforma y muestra el número de la oferta', () => {
  renderPage('/sales?origin=PROFORMA')
  expect(mocks.args.at(-1)).toMatchObject({ origin: 'PROFORMA' })
  expect(screen.getByLabelText('Origen')).toHaveValue('PROFORMA')
  const table = screen.getByRole('table', { name: 'Ventas' })
  expect(within(table).getByText('COM-PRO-000004')).toHaveClass('code')
  expect(within(table).getByText(/Proforma/)).toBeInTheDocument()
})

it('conserva los filtros de venta directa y de mantenimiento', () => {
  renderPage('/sales?origin=MAINTENANCE')
  const options = within(screen.getByLabelText('Origen'))
    .getAllByRole('option')
    .map((option) => option.textContent)
  expect(options).toEqual([
    'Todos',
    'Venta directa',
    'Mantenimiento',
    'Proforma',
  ])
  expect(mocks.args.at(-1)).toMatchObject({ origin: 'MAINTENANCE' })
})

it('cada origen tiene su etiqueta', () => {
  const direct = render(
    <SaleOriginLabel
      origin={{ type: 'DIRECT', order_id: null, order_number: null }}
    />,
  )
  expect(direct.container).toHaveTextContent('Directa')
  const linked = render(
    <SaleOriginLabel
      origin={{
        type: 'MAINTENANCE',
        order_id: 2,
        order_number: 'ART-OT-000002',
      }}
    />,
  )
  expect(linked.container).toHaveTextContent('Mantenimiento ART-OT-000002')
})

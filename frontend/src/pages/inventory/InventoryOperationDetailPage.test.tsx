import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ data: {} as Record<string, unknown> }))
vi.mock('@/features/inventory/hooks', () => ({
  useOperation: () => ({
    data: mocks.data,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

import { InventoryOperationDetailPage } from './InventoryOperationDetailPage'

const base = {
  id: 44,
  reference: 'INV-44',
  kind: 'REVERSAL',
  state: 'POSTED',
  version: 2,
  product: { id: 5, code: 'ACE-1', name: 'Aceite', is_active: true },
  quantity: '3',
  origin: { type: 'MANUAL_VOID', reference: 'INV-44' },
  reverses_reference: 'INV-40',
  created_at: '2026-09-01T10:00:00Z',
  posted_at: '2026-09-01T10:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/inventory/operations/44']}>
      <Routes>
        <Route
          element={<InventoryOperationDetailPage />}
          path="/inventory/operations/:id"
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.data = base
})

it('vincula la compensación con su original y no enlaza el origen sin autorización', () => {
  renderPage()
  expect(screen.getByRole('link', { name: 'INV-40' })).toHaveAttribute(
    'href',
    '/inventory/operations/40',
  )
  expect(screen.queryByRole('link', { name: 'Abrir origen' })).toBeNull()
  expect(document.body.textContent).not.toMatch(/USD/)
})

it('enlaza el origen solo cuando el backend lo autoriza', () => {
  mocks.data = {
    ...base,
    kind: 'PURCHASE_RECEIPT',
    reverses_reference: null,
    origin: {
      type: 'PURCHASE',
      reference: 'INV-44',
      origin_url: '/purchases/7',
    },
  }
  renderPage()
  expect(screen.getByRole('link', { name: 'Abrir origen' })).toHaveAttribute(
    'href',
    '/purchases/7',
  )
})

it('muestra la valoración únicamente cuando la proyección económica la incluye', () => {
  mocks.data = {
    ...base,
    entry_value: '20.000000',
    unit_cost: '2.000000',
    movements: [
      {
        ordinal: 3,
        product_id: 5,
        applied_unit_cost: '2.000000',
        value_delta: '20.000000',
        rounding_adjustment: '0.000000',
        value_after: '40.000000',
        average_after: '2.000000',
      },
    ],
  }
  renderPage()
  expect(screen.getByLabelText('Valoración')).toHaveTextContent('USD 20.00')
  expect(screen.getByLabelText('Movimientos')).toHaveTextContent(
    'Ajuste de redondeo',
  )
})

it('una entrada sin costo se presenta como sin costo registrado, no como cero', () => {
  mocks.data = {
    ...base,
    kind: 'PURCHASE_RECEIPT',
    entry_value: null,
    unit_cost: null,
    movements: [
      {
        ordinal: 1,
        product_id: 5,
        cost_known: false,
        applied_unit_cost: null,
        value_delta: null,
        rounding_adjustment: '0.000000',
        regularization_value: '0.000000',
        value_after: null,
        average_after: null,
      },
    ],
  }
  renderPage()
  expect(screen.getByLabelText('Valoración')).toHaveTextContent('Sin costo')
  expect(screen.getByLabelText('Valoración')).not.toHaveTextContent('USD')
  const movimientos = within(screen.getByLabelText('Movimientos'))
  // Costo aplicado, variación y valor posterior: tres celdas ausentes, ninguna en cero.
  expect(movimientos.getAllByText('Sin costo')).toHaveLength(3)
  expect(screen.getByLabelText('Movimientos')).not.toHaveTextContent('null')
})

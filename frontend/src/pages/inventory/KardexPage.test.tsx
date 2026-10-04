import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  result: {} as Record<string, unknown>,
  calls: [] as Array<[number | null, Record<string, unknown>]>,
  refetch: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/inventory/hooks', () => ({
  useKardex: (id: number | null, filters: Record<string, unknown>) => {
    mocks.calls.push([id, filters])
    return { ...mocks.result, refetch: mocks.refetch }
  },
}))

import { KardexPage } from './KardexPage'

const row = (ordinal: number, extra: object = {}) => ({
  ordinal,
  effective_at: '2026-09-05T17:00:00Z',
  movement_type: 'ADJUSTMENT_IN',
  source: { type: 'ADJUSTMENT_IN', reference: `INV-${ordinal + 20}` },
  actor_id: 1,
  quantity_in: '5',
  quantity_out: '0',
  quantity_before: '10',
  quantity_after: '15',
  presentation: {
    code: 'ACE-1',
    name: 'Aceite',
    content_quantity: '4',
    unit_name: 'Galón',
    unit_symbol: 'gal',
  },
  ...extra,
})

const kardex = (extra: object = {}) => ({
  count: 2,
  page: 1,
  page_size: 20,
  total_pages: 1,
  results: [
    row(2),
    row(3, {
      quantity_before: '15',
      quantity_after: '12',
      quantity_in: '0',
      quantity_out: '3',
      movement_type: 'ADJUSTMENT_OUT',
    }),
  ],
  cut: { token: 'corte-1', ordinal: 3, expires_in_seconds: 1800 },
  opening_quantity: '10',
  closing_quantity: '12',
  period_totals: { count: 2, quantity_in: '5', quantity_out: '3' },
  matching_totals: { count: 1, quantity_in: '0', quantity_out: '3' },
  page_opening_quantity: '15',
  ...extra,
})

function renderPage(
  path:
    | string
    | { pathname: string; state: unknown } = '/inventory/products/9/kardex',
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<KardexPage />} path="/inventory/products/:id/kardex" />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.calls.length = 0
  mocks.permissions = ['inventario.ver']
  mocks.result = { isPending: false, isError: false, data: kardex() }
})

it('distingue los saldos del período de los totales de coincidencias', () => {
  renderPage()
  const period = screen.getByLabelText('Saldos del período')
  expect(period).toHaveTextContent('Saldo inicial')
  expect(period).toHaveTextContent('10')
  expect(period).toHaveTextContent('Saldo final')
  expect(period).toHaveTextContent('2 movimientos · entradas 5 · salidas 3')
  const matching = screen.getByLabelText('Coincidencias con los filtros')
  expect(matching).toHaveTextContent('1 movimientos · entradas 0 · salidas 3')
  expect(matching).toHaveTextContent(
    'Saldo antes de la primera fila de esta página: 15',
  )
})

it('muestra entrada, salida, saldo y responsable por fila', () => {
  renderPage()
  expect(screen.getAllByText('Entrada').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Salida').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Saldo').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Usuario #1').length).toBeGreaterThan(0)
  expect(screen.getAllByText('12').length).toBeGreaterThan(0)
})

it('conserva el corte al paginar y lo renueva solo por un cambio de filtros o un refresco explícito', async () => {
  renderPage('/inventory/products/9/kardex?page=2&movement_type=ADJUSTMENT_OUT')
  expect(mocks.calls.at(-1)![1]).toMatchObject({ page: 2, cutToken: 'corte-1' })
  await userEvent.selectOptions(
    screen.getByLabelText('Tipo de movimiento'),
    'ADJUSTMENT_IN',
  )
  const first = mocks.calls.find(([, f]) => f.movementType === 'ADJUSTMENT_IN')!
  expect(first[1].cutToken).toBeUndefined() // nunca reutiliza el corte con otros filtros
})

it('avisa que se lee un corte y el refresco explícito solicita otro', async () => {
  renderPage()
  expect(
    screen.getByText('Está leyendo un corte de la historia'),
  ).toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: /actualizar corte/i }),
  )
  expect(mocks.refetch).toHaveBeenCalled()
})

it('las columnas económicas solo aparecen con el permiso de valoración', () => {
  mocks.result = {
    isPending: false,
    isError: false,
    data: kardex({
      opening_value: '20.000000',
      closing_value: '24.000000',
      results: [
        row(2, { applied_unit_cost: '2.000000', value_after: '30.000000' }),
      ],
    }),
  }
  renderPage()
  expect(screen.queryByText('Costo aplicado')).toBeNull()
  expect(screen.queryByText(/Valor inicial/)).toBeNull()
  mocks.permissions = ['inventario.ver', 'inventario.ver_valorizacion']
  renderPage()
  expect(screen.getAllByText('Costo aplicado').length).toBeGreaterThan(0)
  expect(screen.getByText(/Valor inicial USD 20.000000/)).toBeInTheDocument()
})

it('un corte vencido pide actualizar en lugar de mezclar cortes', () => {
  mocks.result = {
    isPending: false,
    isError: true,
    data: undefined,
    error: new ProblemError('Vencido', 409, 'stale_record'),
  }
  renderPage()
  expect(screen.getByRole('alert')).toHaveTextContent('El corte venció')
})

it('sin movimientos que coincidan mantiene los resúmenes y avisa del vacío', () => {
  mocks.result = {
    isPending: false,
    isError: false,
    data: kardex({
      results: [],
      count: 0,
      page_opening_quantity: null,
      matching_totals: { count: 0, quantity_in: '0', quantity_out: '0' },
    }),
  }
  renderPage()
  expect(screen.getByText('Sin movimientos')).toBeInTheDocument()
  expect(screen.getByLabelText('Saldos del período')).toHaveTextContent('12')
})

it('vuelve a la ficha del producto cuando se llegó desde ella', () => {
  renderPage({
    pathname: '/inventory/products/9/kardex',
    state: { from: '/products/9' },
  })
  expect(
    screen.getByRole('link', { name: 'Volver a la ficha del producto' }),
  ).toHaveAttribute('href', '/products/9')
})

it('los movimientos sin costo registrado se marcan como tales y no como cero', () => {
  mocks.permissions = ['inventario.ver', 'inventario.ver_valorizacion']
  mocks.result = {
    isPending: false,
    isError: false,
    data: kardex({
      opening_value: '0.000000',
      closing_value: null,
      results: [
        row(2, {
          cost_known: false,
          applied_unit_cost: null,
          value_delta: null,
          value_after: null,
          regularization_value: '0.000000',
        }),
      ],
    }),
  }
  renderPage()
  expect(screen.getAllByText('Sin costo').length).toBeGreaterThanOrEqual(3)
  expect(screen.getByText(/Valor inicial USD 0.000000/)).toBeInTheDocument()
  expect(screen.queryByText(/valor final USD null/i)).toBeNull()
})

it('la primera entrada con costo explica el valor asignado a las unidades previas', async () => {
  mocks.permissions = ['inventario.ver', 'inventario.ver_valorizacion']
  mocks.result = {
    isPending: false,
    isError: false,
    data: kardex({
      opening_value: null,
      closing_value: '20.000000',
      results: [
        row(2, {
          cost_known: true,
          applied_unit_cost: '2.000000',
          value_after: '20.000000',
          regularization_value: '10.000000',
        }),
      ],
    }),
  }
  renderPage()
  const [hint] = screen.getAllByRole('button', {
    name: /costo asignado a unidades previas/i,
  })
  await userEvent.hover(hint!)
  expect(await screen.findByText(/asignó USD 10.000000/)).toBeInTheDocument()
})

it('los roles sin valoración no reciben ni insinúan costos ausentes', () => {
  mocks.result = {
    isPending: false,
    isError: false,
    data: kardex({ results: [row(2)] }),
  }
  renderPage()
  expect(screen.queryByText('Sin costo')).toBeNull()
})

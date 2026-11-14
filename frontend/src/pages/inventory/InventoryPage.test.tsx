import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  stock: {} as Record<string, unknown>,
  args: [] as unknown[],
  create: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/product-categories/hooks', () => ({
  useProductCategoryList: () => ({
    data: { results: [{ id: 2, name: 'Lubricantes' }] },
  }),
}))
vi.mock('@/features/inventory/hooks', () => ({
  useStock: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.stock
  },
  useOperationMutations: () => ({
    create: { mutateAsync: mocks.create },
    preview: { mutateAsync: mocks.preview },
    confirm: { mutateAsync: mocks.confirm },
  }),
}))
vi.mock('@/features/purchases/pickers', () => ({
  useProductOptions: () => ({
    isPending: false,
    isError: false,
    data: { totalPages: 1, options: [{ id: 5, label: 'ACE-1 — Aceite' }] },
  }),
}))

import { ToastProvider } from '@/shared/ui'
import { InventoryPage } from './InventoryPage'

const row = (name: string, quantity: string, extra: object = {}) => ({
  product: {
    id: 5,
    code: 'ACE-1',
    manufacturer_code: '',
    name,
    category: { id: 2, name: 'Lubricantes' },
    unit: { name: 'Galón', symbol: 'gal' },
    content_quantity: '4.000000',
    is_active: true,
  },
  quantity,
  reserved: '0',
  available: quantity,
  version: 2,
  last_ordinal: 4,
  ...extra,
})

function renderPage(path = '/inventory') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/inventory" element={<InventoryPage />} />
          <Route
            path="/inventory/products/:id/kardex"
            element={<div>Kardex del producto</div>}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.args.length = 0
  mocks.permissions = ['inventario.ver']
  mocks.stock = {
    isPending: false,
    isError: false,
    data: {
      count: 2,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [row('Aceite', '7'), row('Sin movimiento', '0')],
    },
  }
  mocks.create.mockResolvedValue({
    id: 30,
    reference: 'INV-30',
    version: 1,
    kind: 'ADJUSTMENT_OUT',
  })
  mocks.preview.mockResolvedValue({
    operation_id: 30,
    state: 'PREPARED',
    version: 1,
    can_confirm: true,
    issues: [],
    effects: [
      {
        product_id: '5',
        current_quantity: '7',
        resulting_quantity: '4',
        resulting_average: '2.000000',
      },
    ],
    review_token: 'tok',
    expires_in_seconds: 900,
  })
  mocks.confirm.mockResolvedValue({ id: 30 })
})

it('muestra presentación, unidad y existencia y distingue el cero real sin umbrales', () => {
  renderPage()
  expect(screen.getAllByText('4.000000 gal').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Agotado').length).toBeGreaterThan(0)
  expect(screen.queryByText(/stock bajo|stock mínimo|por debajo/i)).toBeNull()
})

it('abre el Kardex al seleccionar una fila', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getAllByText('Aceite')[0]!)
  expect(await screen.findByText('Kardex del producto')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('un fallo de consulta ofrece reintentar y nunca presenta cero como saldo', () => {
  mocks.stock = { isPending: false, isError: true, refetch: vi.fn() }
  renderPage()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No se muestra ningún saldo',
  )
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  expect(screen.queryByText('0')).toBeNull()
})

it('los filtros de búsqueda, categoría, estado y existencias viajan en la dirección', () => {
  renderPage(
    '/inventory?category_id=2&active=all&stock=zero&search=aceite&page=2',
  )
  expect(mocks.args.at(-1)).toMatchObject({
    search: 'aceite',
    categoryId: 2,
    isActive: 'all',
    stock: 'zero',
    page: 2,
  })
})

it('las columnas económicas exigen el permiso de valoración', () => {
  renderPage()
  expect(screen.queryByText(/Costo promedio/)).toBeNull()
  mocks.permissions = ['inventario.ver', 'inventario.ver_valorizacion']
  mocks.stock = {
    isPending: false,
    isError: false,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [
        row('Aceite', '7', {
          average_cost: '2.000000',
          inventory_value: '14.000000',
        }),
      ],
    },
  }
  renderPage()
  expect(screen.getAllByText(/Costo promedio/).length).toBeGreaterThan(0)
  expect(screen.getAllByText('USD 14.00').length).toBeGreaterThan(0)
})

it('la interfaz operativa no ofrece ajustes ni muestra dinero', () => {
  renderPage()
  expect(
    screen.queryByRole('button', { name: /carga inicial o ajuste/i }),
  ).toBeNull()
  expect(document.body.textContent).not.toMatch(/USD/)
})

it('el ajuste exige motivo y costo explícito solo en entradas, revisa el efecto y confirma en el mismo panel', async () => {
  mocks.permissions = ['inventario.ver', 'inventario.ajustar']
  renderPage()
  await userEvent.click(
    screen.getByRole('button', { name: /carga inicial o ajuste/i }),
  )
  const drawer = await screen.findByRole('dialog')
  expect(within(drawer).queryByLabelText('Costo unitario')).toBeNull() // salida por omisión
  await userEvent.click(
    within(drawer).getByRole('button', { name: 'Preparar y revisar' }),
  )
  expect(
    within(drawer).getByText('Seleccione un producto.'),
  ).toBeInTheDocument()
  expect(
    within(drawer).getByText('El motivo es obligatorio.'),
  ).toBeInTheDocument()
  await userEvent.selectOptions(
    within(drawer).getByLabelText('Tipo de operación'),
    'ADJUSTMENT_IN',
  )
  expect(within(drawer).getByLabelText('Costo unitario')).toBeInTheDocument()
  await userEvent.selectOptions(
    within(drawer).getByLabelText('Tipo de operación'),
    'ADJUSTMENT_OUT',
  )
  await userEvent.click(
    within(drawer).getByRole('combobox', { name: 'Producto' }),
  )
  await userEvent.click(screen.getByRole('option', { name: /ACE-1 — Aceite/ }))
  await userEvent.type(
    within(drawer).getByLabelText('Cantidad de presentaciones'),
    '3',
  )
  await userEvent.type(
    within(drawer).getByLabelText('Motivo'),
    'Pérdida comprobada',
  )
  await userEvent.click(
    within(drawer).getByRole('button', { name: 'Preparar y revisar' }),
  )
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  expect(mocks.create.mock.calls[0]![0].data).toMatchObject({
    kind: 'ADJUSTMENT_OUT',
    product_id: 5,
    quantity: '3',
    reason: 'Pérdida comprobada',
  })
  expect(mocks.create.mock.calls[0]![0].data).not.toHaveProperty('unit_cost')
  expect(
    await within(drawer).findByLabelText('Revisión del efecto'),
  ).toHaveTextContent('resultará 4')
  expect(screen.getAllByRole('dialog')).toHaveLength(1) // sin segunda trampa de foco
  await userEvent.click(
    within(drawer).getByRole('button', { name: 'Confirmar operación' }),
  )
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1))
  expect(mocks.confirm.mock.calls[0]![0]).toMatchObject({
    id: 30,
    expectedVersion: 1,
    reviewToken: 'tok',
  })
  expect(await screen.findByText(/contabilizada: INV-30/)).toBeInTheDocument()
})

it('con impedimentos en la revisión no permite confirmar y ofrece abandonar sin cambiar existencias', async () => {
  mocks.permissions = ['inventario.ver', 'inventario.ajustar']
  mocks.preview.mockResolvedValue({
    operation_id: 30,
    state: 'PREPARED',
    version: 1,
    can_confirm: false,
    issues: [
      { code: 'insufficient_stock', message: 'La existencia es insuficiente.' },
    ],
    effects: [],
    review_token: null,
    expires_in_seconds: 900,
  })
  renderPage()
  await userEvent.click(
    screen.getByRole('button', { name: /carga inicial o ajuste/i }),
  )
  const modal = await screen.findByRole('dialog')
  await userEvent.click(
    within(modal).getByRole('combobox', { name: 'Producto' }),
  )
  await userEvent.click(screen.getByRole('option', { name: /ACE-1 — Aceite/ }))
  await userEvent.type(
    within(modal).getByLabelText('Cantidad de presentaciones'),
    '50',
  )
  await userEvent.type(within(modal).getByLabelText('Motivo'), 'Salida')
  await userEvent.click(
    within(modal).getByRole('button', { name: 'Preparar y revisar' }),
  )
  expect(
    await within(modal).findByLabelText('Revisión del efecto'),
  ).toHaveTextContent('La existencia es insuficiente')
  expect(
    within(modal).getByRole('button', { name: 'Confirmar operación' }),
  ).toBeDisabled()
  await userEvent.click(
    within(modal).getByRole('button', { name: 'Abandonar sin confirmar' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(mocks.confirm).not.toHaveBeenCalled()
})

it('muestra reservado y disponible junto a la existencia', () => {
  renderPage()
  expect(screen.getAllByText('Reservado').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0)
})

it('el Administrador ve el valor del inventario y cuántos productos quedan fuera por no tener costo', async () => {
  mocks.permissions = ['inventario.ver', 'inventario.ver_valorizacion']
  mocks.stock = {
    isPending: false,
    isError: false,
    data: {
      count: 2,
      page: 1,
      page_size: 20,
      total_pages: 1,
      valuation: { total_value: '40.000000', products_without_cost: 1 },
      results: [
        row('Aceite', '7', {
          cost_registered: true,
          average_cost: '2.000000',
          inventory_value: '14.000000',
        }),
        row('Filtro', '8', {
          cost_registered: false,
          average_cost: null,
          inventory_value: null,
        }),
      ],
    },
  }
  renderPage()
  const summary = screen.getByLabelText('Valor del inventario')
  expect(summary).toHaveTextContent('USD 40.00')
  expect(summary).toHaveTextContent('1 sin costo')
  await userEvent.hover(
    within(summary).getByRole('button', {
      name: /productos sin costo registrado/i,
    }),
  )
  expect(await screen.findByText(/no suma a este valor/)).toBeInTheDocument()
  expect(screen.getAllByText('Sin costo').length).toBeGreaterThanOrEqual(2)
  expect(screen.queryByText('USD null')).toBeNull()
})

it('sin productos sin costo no se muestra ninguna advertencia', () => {
  mocks.permissions = ['inventario.ver', 'inventario.ver_valorizacion']
  mocks.stock = {
    isPending: false,
    isError: false,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      valuation: { total_value: '14.000000', products_without_cost: 0 },
      results: [
        row('Aceite', '7', {
          cost_registered: true,
          average_cost: '2.000000',
          inventory_value: '14.000000',
        }),
      ],
    },
  }
  renderPage()
  expect(screen.getByLabelText('Valor del inventario')).toHaveTextContent(
    'USD 14.00',
  )
  expect(screen.queryByText(/sin costo/i)).toBeNull()
})

it('la interfaz operativa no recibe ni muestra el valor del inventario ni avisos de costo', () => {
  renderPage()
  expect(screen.queryByLabelText('Valor del inventario')).toBeNull()
  expect(screen.queryByText(/sin costo/i)).toBeNull()
})

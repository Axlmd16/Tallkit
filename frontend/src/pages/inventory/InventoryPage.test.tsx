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
  version: 2,
  last_ordinal: 4,
  ...extra,
})

function renderPage(path = '/inventory') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/inventory" element={<InventoryPage />} />
        <Route
          path="/inventory/products/:id/kardex"
          element={<div>Kardex del producto</div>}
        />
      </Routes>
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
  expect(screen.getAllByText('Sin existencia').length).toBeGreaterThan(0)
  expect(screen.queryByText(/stock bajo|stock mínimo|por debajo/i)).toBeNull()
})

it('abre el Kardex al seleccionar una fila', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getAllByText('ACE-1 — Aceite')[0]!)
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
  expect(screen.getAllByText('USD 14.000000').length).toBeGreaterThan(0)
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

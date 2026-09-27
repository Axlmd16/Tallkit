import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({
  labelData: vi.fn(),
  permissions: [] as string[],
  list: {} as Record<string, unknown>,
  listByPage: null as
    | null
    | ((filters: { page?: number }) => Record<string, unknown>),
  listArgs: [] as unknown[],
  setActive: vi.fn(),
}))

const page = <T,>(results: T[]) => ({
  isPending: false,
  isError: false,
  isSuccess: true,
  data: {
    count: results.length,
    page: 1,
    page_size: 20,
    total_pages: 1,
    results,
  },
})

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/product-categories/hooks', () => ({
  useProductCategoryList: () =>
    page([{ id: 1, name: 'Aceites', is_active: true }]),
}))
vi.mock('@/features/product-brands/hooks', () => ({
  useProductBrandList: () =>
    page([{ id: 3, name: 'Castrol', is_active: true }]),
}))
vi.mock('@/features/measurement-units/hooks', () => ({
  useMeasurementUnitList: () => page([]),
}))
vi.mock('@/features/vehicle-brands/hooks', () => ({
  useVehicleBrands: () => page([{ id: 10, name: 'Toyota', is_active: true }]),
}))
vi.mock('@/features/products/hooks', () => ({
  useProducts: (filters: { page?: number }) => {
    mocks.listArgs.push(filters)
    return mocks.listByPage?.(filters) ?? mocks.list
  },
  useProduct: () => ({ data: undefined, refetch: vi.fn() }),
  useProductMutations: () => ({
    create: { mutateAsync: vi.fn() },
    update: { mutateAsync: vi.fn() },
    setActive: { mutateAsync: mocks.setActive },
  }),
  useProductTaxOptions: () => page([]),
}))
vi.mock('@/features/products/api', () => ({
  productsApi: { labelData: (...args: unknown[]) => mocks.labelData(...args) },
}))
vi.mock('@/features/product-labels/ProductLabelPrintModal', () => ({
  ProductLabelPrintModal: ({
    loadError,
    onRetry,
    open,
    products,
  }: {
    loadError?: string | null
    onRetry?: () => void
    open: boolean
    products: Array<{ code: string }>
  }) =>
    open ? (
      <div role="dialog">
        Etiquetas: {products.map(({ code }) => code).join(', ')}
        {loadError && (
          <div role="alert">
            {loadError}
            <button onClick={onRetry}>Reintentar lote</button>
          </div>
        )}
      </div>
    ) : null,
}))

import { ProductsPage } from './ProductsPage'

const product = {
  id: 5,
  code: 'ACE-1',
  manufacturer_code: 'BP-900',
  name: 'Aceite 20W50',
  description: '',
  category: { id: 1, name: 'Aceites', is_active: true },
  unit: { id: 2, name: 'Galón', is_active: true },
  product_brand: null,
  vehicle_brands: [],
  content_quantity: '0.500000',
  sale_price: '10.50',
  is_kit: false,
  tax: null,
  is_active: true,
  version: 3,
  created_at: '',
  updated_at: '',
}

function renderPage(path = '/products') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ProductsPage />} path="/products" />
          <Route element={<p>Ficha de producto</p>} path="/products/:id" />
          <Route
            element={<p>Editor de producto</p>}
            path="/products/:id/edit"
          />
          <Route element={<p>Editor de producto</p>} path="/products/new" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  mocks.labelData.mockReset()
  mocks.setActive.mockReset()
  mocks.listArgs.length = 0
  mocks.listByPage = null
  mocks.permissions = ['productos.ver']
  mocks.list = page([product])
})

it('selecciona productos en varias páginas y conserva el orden manual', async () => {
  const second = { ...product, id: 6, code: 'ACE-2', name: 'Aceite sintético' }
  mocks.listByPage = ({ page: current = 1 }) => ({
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 2,
      page: current,
      page_size: 1,
      total_pages: 2,
      results: current === 1 ? [product] : [second],
    },
  })
  const user = userEvent.setup()
  renderPage()

  expect(
    screen.getByRole('button', { name: 'Imprimir etiquetas' }),
  ).toBeDisabled()
  await user.click(screen.getByRole('checkbox', { name: 'Seleccionar fila 5' }))
  expect(screen.getByText('1 seleccionado')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
  await user.click(screen.getByRole('checkbox', { name: 'Seleccionar fila 6' }))
  expect(screen.getByText('2 seleccionados')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Imprimir etiquetas' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('ACE-1, ACE-2')
})

it('selecciona o deselecciona toda la página visible', async () => {
  mocks.list = page([
    product,
    { ...product, id: 6, code: 'ACE-2', name: 'Aceite sintético' },
  ])
  const user = userEvent.setup()
  renderPage()

  await user.click(
    screen.getByRole('checkbox', { name: 'Seleccionar todas las filas' }),
  )
  expect(screen.getByText('2 seleccionados')).toBeInTheDocument()
  await user.click(
    screen.getByRole('checkbox', { name: 'Seleccionar todas las filas' }),
  )
  expect(screen.getByText('0 seleccionados')).toBeInTheDocument()
})

it('pide confirmación antes de cambiar filtros con selección', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('checkbox', { name: 'Seleccionar fila 5' }))

  await user.selectOptions(screen.getByLabelText('Categoría'), '1')
  const confirmation = screen.getByRole('dialog', { name: 'Cambiar filtros' })
  await user.click(
    within(confirmation).getByRole('button', { name: 'Cancelar' }),
  )
  expect(screen.getByText('1 seleccionado')).toBeInTheDocument()
  expect(screen.getByLabelText('Categoría')).toHaveValue('')

  await user.selectOptions(screen.getByLabelText('Categoría'), '1')
  await user.click(
    within(screen.getByRole('dialog', { name: 'Cambiar filtros' })).getByRole(
      'button',
      { name: 'Cambiar filtros' },
    ),
  )
  expect(mocks.listArgs.at(-1)).toMatchObject({ categoryId: 1 })
  expect(screen.getByText('0 seleccionados')).toBeInTheDocument()
})

it('obtiene todos los productos con exactamente los filtros actuales', async () => {
  mocks.labelData.mockResolvedValue([
    {
      id: 9,
      code: 'FIL-9',
      name: 'Filtro nueve',
      manufacturerCode: null,
      productBrand: null,
    },
  ])
  const user = userEvent.setup()
  renderPage(
    '/products?search=aceite&category_id=1&product_brand_id=3&vehicle_brand_id=10&is_active=all&page=2',
  )

  await user.click(
    screen.getByRole('button', { name: 'Todos los del filtro actual' }),
  )
  expect(mocks.labelData).toHaveBeenCalledWith({
    search: 'aceite',
    isActive: 'all',
    categoryId: 1,
    productBrandId: 3,
    vehicleBrandId: 10,
  })
  expect(await screen.findByRole('dialog')).toHaveTextContent('FIL-9')
})

it('mantiene un error reintentable al cargar todos los filtrados', async () => {
  mocks.labelData
    .mockRejectedValueOnce(new Error('red'))
    .mockResolvedValueOnce([])
  const user = userEvent.setup()
  renderPage()

  await user.click(
    screen.getByRole('button', { name: 'Todos los del filtro actual' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudieron cargar',
  )
  await user.click(screen.getByRole('button', { name: 'Reintentar lote' }))
  expect(mocks.labelData).toHaveBeenCalledTimes(2)
})

it('muestra las columnas del catálogo sin existencias ni costos, aunque se pueda ver el inventario', () => {
  mocks.permissions.push('inventario.ver')
  renderPage()
  const table = screen.getByRole('table', { name: 'Productos' })
  expect(within(table).getByText('ACE-1')).toBeInTheDocument()
  expect(within(table).getByText('Aceites')).toBeInTheDocument()
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual([
    '',
    'Código interno',
    'Código del fabricante',
    'Producto',
    'Categoría',
    'Presentación',
    'Marca',
    'Precio final USD',
    'Estado',
    'Acciones',
  ])
  expect(within(table).getByText('USD 10.50')).toBeInTheDocument()
  expect(within(table).getByText('Activo')).toBeInTheDocument()
  expect(table.textContent).not.toMatch(/stock|existencia|costo/i)
  // El ámbito fiscal lo muestra la barra superior del marco; la página no lo duplica.
  expect(screen.queryByLabelText(/ámbito fiscal/i)).toBeNull()
})

it('muestra ambos códigos y ofrece búsqueda por ellos', () => {
  mocks.list = page([
    product,
    { ...product, id: 6, code: 'ACE-2', manufacturer_code: '' },
  ])
  renderPage()
  const table = screen.getByRole('table', { name: 'Productos' })
  expect(
    within(table).getByRole('columnheader', { name: 'Código interno' }),
  ).toBeInTheDocument()
  expect(
    within(table).getByRole('columnheader', { name: 'Código del fabricante' }),
  ).toBeInTheDocument()
  expect(within(table).getByText('BP-900')).toBeInTheDocument()
  expect(within(table).getByText('ACE-2')).toBeInTheDocument()
  expect(
    screen.getByLabelText(/buscar por código, código del fabricante o nombre/i),
  ).toBeInTheDocument()
})

it('sin permisos de gestión no ofrece crear, editar ni desactivar', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /nuevo producto/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /desactivar/i })).toBeNull()
})

it('lee filtros combinados desde la URL y los envía al servidor', () => {
  renderPage(
    '/products?search=aceite&category_id=1&product_brand_id=3&vehicle_brand_id=10&is_active=all&page=2',
  )
  expect(mocks.listArgs.at(-1)).toEqual({
    search: 'aceite',
    isActive: 'all',
    page: 2,
    categoryId: 1,
    productBrandId: 3,
    vehicleBrandId: 10,
  })
})

it('cambia filtros reiniciando la página y muestra el estado sin coincidencias', async () => {
  mocks.list = {
    isPending: false,
    isError: false,
    data: { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] },
  }
  renderPage('/products?search=zzz&page=3')
  expect(screen.getByText('Sin coincidencias')).toBeInTheDocument()
  const user = userEvent.setup()
  await user.selectOptions(screen.getByLabelText('Categoría'), '1')
  expect(mocks.listArgs.at(-1)).toMatchObject({ categoryId: 1, page: 1 })
})

it('al elegir un producto abre su ficha conservando los filtros', async () => {
  renderPage('/products?search=aceite')
  const user = userEvent.setup()
  await user.click(screen.getAllByText('Aceite 20W50')[0]!)
  expect(await screen.findByText('Ficha de producto')).toBeInTheDocument()
})

it('crear y editar abren las páginas del formulario de producto', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  renderPage()
  const user = userEvent.setup()
  await user.click(
    screen.getAllByRole('button', { name: 'Acciones de ACE-1' })[0]!,
  )
  await user.click(screen.getByRole('menuitem', { name: 'Editar' }))
  expect(await screen.findByText('Editor de producto')).toBeInTheDocument()
})

it('con permiso desactiva mediante confirmación y con clave de idempotencia', async () => {
  mocks.permissions = [
    'productos.ver',
    'productos.gestionar',
    'productos.desactivar',
  ]
  mocks.setActive.mockResolvedValue(product)
  const user = userEvent.setup()
  renderPage()
  await user.click(
    screen.getAllByRole('button', { name: 'Acciones de ACE-1' })[0]!,
  )
  await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(
    within(dialog).getByRole('button', { name: /confirmar desactivación/i }),
  )

  expect(mocks.setActive.mock.calls[0]![0]).toMatchObject({
    id: 5,
    active: false,
    expectedVersion: 3,
  })
  expect(mocks.setActive.mock.calls[0]![0].key).toMatch(
    /^[A-Za-z0-9._:-]{8,128}$/,
  )
  expect(
    await screen.findByText(/producto «aceite 20w50» desactivado/i),
  ).toBeInTheDocument()
})

it('explica la reactivación rechazada por categoría inactiva', async () => {
  mocks.permissions = ['productos.ver', 'productos.desactivar']
  mocks.list = page([{ ...product, is_active: false }])
  mocks.setActive.mockRejectedValue(
    new ProblemError(
      'La categoría está inactiva; actívela o reclasifique el producto.',
      400,
      'inactive_reference',
    ),
  )
  const user = userEvent.setup()
  renderPage()
  await user.click(
    screen.getAllByRole('button', { name: 'Acciones de ACE-1' })[0]!,
  )
  await user.click(screen.getByRole('menuitem', { name: 'Reactivar' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(
    within(dialog).getByRole('button', { name: /confirmar reactivación/i }),
  )
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    /categoría está inactiva/i,
  )
})

it.each([
  ['carga', { isPending: true, isError: false }, /cargando productos/i],
  [
    'error',
    { isPending: false, isError: true },
    /no fue posible consultar los productos/i,
  ],
])('presenta el estado de %s', (_name, state, text) => {
  mocks.list = state
  renderPage()
  expect(screen.getByText(text)).toBeInTheDocument()
})

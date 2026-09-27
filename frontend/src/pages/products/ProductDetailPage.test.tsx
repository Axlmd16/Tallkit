import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  product: {} as Record<string, unknown>,
  stock: {} as Record<string, unknown>,
  stockArgs: [] as unknown[],
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/products/hooks', () => ({
  useProduct: () => ({
    data: mocks.product,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useProductMutations: () => ({ setActive: { mutateAsync: vi.fn() } }),
}))
vi.mock('@/features/product-labels/ProductLabelPrintModal', () => ({
  ProductLabelPrintModal: ({
    onClose,
    open,
    products,
  }: {
    onClose: () => void
    open: boolean
    products: Array<{ code: string }>
  }) =>
    open ? (
      <div role="dialog">
        Etiqueta: {products[0]?.code}
        <button onClick={onClose}>Cerrar etiquetas</button>
      </div>
    ) : null,
}))
vi.mock('@/features/inventory/hooks', () => ({
  useStockItem: (id: number | null, enabled: boolean) => {
    mocks.stockArgs.push([id, enabled])
    return mocks.stock
  },
}))

import { ProductDetailPage } from './ProductDetailPage'

function Where() {
  const location = useLocation()
  return (
    <p data-testid="where">
      {location.pathname} {JSON.stringify(location.state)}
    </p>
  )
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/products/7']}>
        <Routes>
          <Route element={<ProductDetailPage />} path="/products/:id" />
          <Route element={<Where />} path="/inventory/products/:id/kardex" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  mocks.stockArgs.length = 0
  mocks.permissions = ['productos.ver', 'inventario.ver']
  mocks.product = {
    id: 7,
    code: 'ACE-1',
    manufacturer_code: '',
    name: 'Aceite',
    description: '',
    category: { id: 1, name: 'Lubricantes', is_active: true },
    unit: { id: 1, name: 'Galón', is_active: true },
    product_brand: null,
    vehicle_brands: [],
    content_quantity: '4.000000',
    sale_price: '99.99',
    is_kit: false,
    tax: null,
    is_active: true,
    version: 1,
    created_at: '',
    updated_at: '',
  }
  mocks.stock = {
    isPending: false,
    isError: false,
    data: { quantity: '12', version: 3, last_ordinal: 5 },
  }
})

it.each([true, false])(
  'permite imprimir la etiqueta con productos activos=%s solo con productos.ver',
  async (isActive) => {
    mocks.permissions = ['productos.ver']
    mocks.product = { ...mocks.product, is_active: isActive }
    renderPage()

    await userEvent.click(
      screen.getByRole('button', { name: 'Imprimir etiquetas' }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent('Etiqueta: ACE-1')
  },
)

it('no muestra la acción sin productos.ver', () => {
  mocks.permissions = []
  renderPage()
  expect(
    screen.queryByRole('button', { name: 'Imprimir etiquetas' }),
  ).not.toBeInTheDocument()
})

it('consulta el inventario por separado y enlaza al Kardex conservando el contexto de retorno', async () => {
  renderPage()
  expect(screen.getByLabelText('Existencias')).toHaveTextContent(
    'Existencia actual: 12 presentaciones completas.',
  )
  await userEvent.click(
    screen.getByRole('link', { name: 'Ver Kardex del producto' }),
  )
  expect(screen.getByTestId('where')).toHaveTextContent(
    '/inventory/products/7/kardex',
  )
  expect(screen.getByTestId('where')).toHaveTextContent('"from":"/products/7"')
})

it('sin permiso de inventario no consulta ni muestra existencias', () => {
  mocks.permissions = ['productos.ver']
  renderPage()
  expect(screen.queryByLabelText('Existencias')).toBeNull()
  expect(screen.getByRole('region', { name: 'Precio' })).toHaveTextContent(
    'USD 99.99',
  )
  expect(mocks.stockArgs.at(-1)).toEqual([7, false])
})

it('no habilita la edición de saldos y distingue el costo del precio final de venta', () => {
  mocks.stock = {
    isPending: false,
    isError: false,
    data: {
      quantity: '12',
      average_cost: '2.500000',
      inventory_value: '30.000000',
    },
  }
  renderPage()
  expect(screen.getByText('Precio final')).toBeInTheDocument()
  expect(screen.getByLabelText('Existencias')).toHaveTextContent(
    'Costo promedioUSD 2.50',
  )
  expect(screen.getByLabelText('Existencias')).toHaveTextContent(
    'Valor inventariableUSD 30.00',
  )
  expect(screen.getByLabelText('Existencias')).toHaveTextContent(
    'no es el precio final de venta',
  )
  expect(
    screen.queryByRole('button', { name: /ajustar|editar saldo/i }),
  ).toBeNull()
})

it('un fallo de consulta no presenta cero como saldo confirmado', () => {
  mocks.stock = { isPending: false, isError: true, refetch: vi.fn() }
  renderPage()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No se muestra ningún saldo',
  )
  expect(screen.getByLabelText('Existencias')).not.toHaveTextContent(
    'Existencia actual',
  )
})

it('muestra la ficha en paneles con códigos, compatibilidad e impuesto', () => {
  renderPage()
  expect(
    screen.getByRole('region', { name: 'Datos generales' }),
  ).toHaveTextContent('Lubricantes')
  expect(
    screen.getByRole('region', { name: 'Compatibilidad' }),
  ).toHaveTextContent('Universal')
  expect(
    screen.getByRole('region', { name: 'Precio y existencias' }),
  ).toHaveTextContent('Sin impuesto asignado')
  expect(
    screen.getByRole('button', { name: 'Copiar código ACE-1' }),
  ).toBeInTheDocument()
})

it('muestra reservado, disponible y las órdenes que sostienen la reserva', () => {
  mocks.permissions = ['productos.ver', 'inventario.ver', 'mantenimientos.ver']
  mocks.stock = {
    isPending: false,
    isError: false,
    data: {
      quantity: '12',
      reserved: '2',
      available: '10',
      reservations: [
        {
          quantity: '2',
          sale_id: 31,
          order_id: 9,
          order_number: 'ART-OT-000009',
        },
      ],
    },
  }
  renderPage()
  const stock = screen.getByLabelText('Existencias')
  expect(stock).toHaveTextContent('Reservado2')
  expect(stock).toHaveTextContent('Disponible10')
  expect(stock).toHaveTextContent('no descuentan existencia')
  expect(screen.getByRole('link', { name: 'ART-OT-000009' })).toHaveAttribute(
    'href',
    '/maintenance/9?tab=parts',
  )
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  query: {} as Record<string, unknown>,
  stock: {} as Record<string, unknown>,
  setActive: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/products/hooks', () => ({
  useProduct: () => mocks.query,
  useProductMutations: () => ({ setActive: { mutateAsync: mocks.setActive } }),
}))
vi.mock('@/features/inventory/hooks', () => ({
  useStockItem: () => mocks.stock,
}))
vi.mock('@/features/products/ProductDetails', () => ({
  ProductDetails: ({ product }: { product: { code: string } }) => (
    <p>Detalle {product.code}</p>
  ),
}))

import { ProductDetailPage } from './ProductDetailPage'

const product = {
  id: 7,
  code: 'ACE-1',
  manufacturer_code: 'FAB-1',
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
  version: 5,
  created_at: '',
  updated_at: '',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/products/7']}>
      <ToastProvider>
        <Routes>
          <Route element={<ProductDetailPage />} path="/products/:id" />
          <Route element={<p>Editor</p>} path="/products/:id/edit" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = [
    'productos.ver',
    'productos.gestionar',
    'productos.desactivar',
    'inventario.ver',
  ]
  mocks.query = {
    data: product,
    isPending: false,
    isError: false,
    error: null,
  }
  mocks.stock = { isPending: false, isError: false, data: undefined }
  mocks.setActive.mockResolvedValue(product)
})

it('distinguishes product loading, not found and generic failures', () => {
  mocks.query = { isPending: true, isError: false }
  const loading = renderPage()
  expect(screen.getByText('Cargando producto…')).toBeInTheDocument()
  loading.unmount()

  mocks.query = {
    isPending: false,
    isError: true,
    error: new ProblemError('No existe', 404, 'not_found'),
  }
  const missing = renderPage()
  expect(screen.getByText('Producto no encontrado')).toBeInTheDocument()
  missing.unmount()

  mocks.query = { isPending: false, isError: true, error: new Error('red') }
  renderPage()
  expect(screen.getByText('Error de carga')).toBeInTheDocument()
})

it('navigates to edit when product management is allowed', async () => {
  const user = userEvent.setup()
  renderPage()
  expect(screen.getByText(/Fabricante FAB-1/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  expect(screen.getByText('Editor')).toBeInTheDocument()
})

it('deactivates an active product and announces the completed action', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Desactivar' }))
  await user.click(
    screen.getByRole('button', { name: 'Confirmar desactivación' }),
  )
  expect(mocks.setActive).toHaveBeenCalledWith({
    id: 7,
    active: false,
    expectedVersion: 5,
    key: expect.any(String),
  })
  expect(
    await screen.findByText('Producto «Aceite» desactivado.'),
  ).toBeInTheDocument()
})

it('offers reactivation and keeps actions independently permissioned', async () => {
  const user = userEvent.setup()
  mocks.permissions = ['productos.ver', 'productos.desactivar']
  mocks.query = { ...mocks.query, data: { ...product, is_active: false } }
  renderPage()

  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Reactivar' }))
  await user.click(
    screen.getByRole('button', { name: 'Confirmar reactivación' }),
  )
  expect(mocks.setActive).toHaveBeenCalledWith(
    expect.objectContaining({ active: true }),
  )
})

it('shows the stock loading state without inventing a balance', () => {
  mocks.stock = { isPending: true, isError: false, data: undefined }
  renderPage()
  expect(screen.getByText('Consultando existencias…')).toBeInTheDocument()
  expect(screen.queryByText(/Existencia actual:/)).toBeNull()
})

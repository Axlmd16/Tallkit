import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type { Session } from '@/features/auth/types'

let currentSession: Session

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({
    isPending: false,
    isSuccess: true,
    data: currentSession,
  }),
  useLogin: () => ({ mutateAsync: vi.fn() }),
  useLogout: () => ({ mutateAsync: vi.fn() }),
  useChangePassword: () => ({ mutateAsync: vi.fn() }),
}))

const { stub } = vi.hoisted(() => ({
  stub: (name: string) => () => `Pantalla ${name}`,
}))
vi.mock('@/pages/products/ProductsPage', () => ({
  ProductsPage: stub('productos'),
}))
vi.mock('@/pages/products/ProductDetailPage', () => ({
  ProductDetailPage: stub('ficha de producto'),
}))
vi.mock('@/pages/product-categories/ProductCategoriesPage', () => ({
  ProductCategoriesPage: stub('categorías'),
}))
vi.mock('@/pages/measurement-units/MeasurementUnitsPage', () => ({
  MeasurementUnitsPage: stub('unidades'),
}))
vi.mock('@/pages/product-brands/ProductBrandsPage', () => ({
  ProductBrandsPage: stub('marcas de producto'),
}))
vi.mock('@/pages/services/ServicesPage', () => ({
  ServicesPage: stub('servicios'),
}))
vi.mock('@/pages/services/ServiceDetailPage', () => ({
  ServiceDetailPage: stub('ficha de servicio'),
}))
vi.mock('@/pages/suppliers/SuppliersPage', () => ({
  SuppliersPage: stub('proveedores'),
}))
vi.mock('@/pages/suppliers/SupplierDetailPage', () => ({
  SupplierDetailPage: stub('ficha de proveedor'),
}))

import { App, appRoutes } from './App'

const session = (permissions: string[]): Session => ({
  authenticated: true,
  username: 'usuario',
  roles: [],
  permissions,
  must_change_password: false,
})

function renderPath(path: string) {
  render(
    <App router={createMemoryRouter(appRoutes, { initialEntries: [path] })} />,
  )
}

beforeEach(() => {
  currentSession = session([])
})

const routes: Array<[string, string, string]> = [
  ['/products', 'productos.ver', 'Pantalla productos'],
  ['/products/7', 'productos.ver', 'Pantalla ficha de producto'],
  ['/product-categories', 'productos.ver', 'Pantalla categorías'],
  ['/measurement-units', 'productos.ver', 'Pantalla unidades'],
  ['/product-brands', 'productos.ver', 'Pantalla marcas de producto'],
  ['/services', 'servicios.ver', 'Pantalla servicios'],
  ['/services/7', 'servicios.ver', 'Pantalla ficha de servicio'],
  ['/suppliers', 'proveedores.ver', 'Pantalla proveedores'],
  ['/suppliers/7', 'proveedores.ver', 'Pantalla ficha de proveedor'],
]

it.each(routes)(
  '%s exige %s y responde con su pantalla',
  async (path, permission, text) => {
    currentSession = session([permission])
    renderPath(path)
    expect(await screen.findByText(text)).toBeInTheDocument()
  },
)

it.each(routes)('%s se deniega sin permiso', async (path) => {
  currentSession = session(['inventario.ver'])
  renderPath(path)
  expect(
    await screen.findByRole('heading', { name: 'Acceso no permitido' }),
  ).toBeInTheDocument()
})

it('muestra en la navegación solo lo que la sesión permite y distingue las marcas de vehículo', async () => {
  currentSession = session(['servicios.ver', 'marcas_vehiculo.ver'])
  renderPath('/')
  expect(
    await screen.findByRole('link', { name: 'Servicios' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Marcas de vehículo' }),
  ).toHaveAttribute('href', '/vehicle-brands')
  expect(screen.queryByRole('link', { name: 'Productos' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Proveedores' })).toBeNull()
})

it('un Administrador con todos los permisos ve las tres entradas nuevas', async () => {
  currentSession = session([
    'productos.ver',
    'servicios.ver',
    'proveedores.ver',
  ])
  renderPath('/')
  for (const name of ['Productos', 'Servicios', 'Proveedores']) {
    expect(await screen.findByRole('link', { name })).toBeInTheDocument()
  }
})

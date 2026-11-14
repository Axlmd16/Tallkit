import { render, screen, within } from '@testing-library/react'
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
vi.mock('@/pages/products/ProductEditorPage', () => ({
  ProductEditorPage: stub('editor de producto'),
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
vi.mock('@/pages/suppliers/SuppliersPage', () => ({
  SuppliersPage: stub('proveedores'),
}))
vi.mock('@/pages/suppliers/SupplierDetailPage', () => ({
  SupplierDetailPage: stub('ficha de proveedor'),
}))
vi.mock('@/pages/suppliers/SupplierEditorPage', () => ({
  SupplierEditorPage: stub('editor de proveedor'),
}))
vi.mock('@/pages/customers/CustomerEditorPage', () => ({
  CustomerEditorPage: stub('editor de cliente'),
}))
vi.mock('@/pages/vehicles/VehicleEditorPage', () => ({
  VehicleEditorPage: stub('editor de vehículo'),
}))

import { App, appRoutes } from './App'

/** Enlaces de la navegación principal; el inicio repite los mismos accesos. */
const mainNav = async () =>
  within(
    await screen.findByRole('navigation', { name: 'Navegación principal' }),
  )

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

const navHrefs = async () =>
  (await mainNav())
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))

it('muestra en la navegación solo lo que la sesión permite', async () => {
  currentSession = session(['servicios.ver', 'marcas_vehiculo.ver'])
  renderPath('/')
  await mainNav()
  const hrefs = await navHrefs()
  expect(hrefs).toContain('/services')
  expect(hrefs).toContain('/settings')
  expect(hrefs).not.toContain('/products')
  expect(hrefs).not.toContain('/suppliers')
})

it('un Administrador con permisos de catálogo llega a productos, servicios y ajustes', async () => {
  currentSession = session([
    'productos.ver',
    'servicios.ver',
    'proveedores.ver',
  ])
  renderPath('/')
  await mainNav()
  const hrefs = await navHrefs()
  for (const href of ['/products', '/services', '/settings'])
    expect(hrefs).toContain(href)
})

const productEditorRoutes = ['/products/new', '/products/7/edit']

it.each(productEditorRoutes)(
  '%s abre la página del formulario de producto con productos.gestionar',
  async (path) => {
    currentSession = session(['productos.ver', 'productos.gestionar'])
    renderPath(path)
    expect(
      await screen.findByText('Pantalla editor de producto'),
    ).toBeInTheDocument()
  },
)

it.each(productEditorRoutes)(
  '%s se deniega a quien solo puede consultar productos',
  async (path) => {
    currentSession = session(['productos.ver'])
    renderPath(path)
    expect(
      await screen.findByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeInTheDocument()
  },
)

it('las rutas de consulta de productos siguen intactas junto a las nuevas', async () => {
  currentSession = session(['productos.ver', 'productos.gestionar'])
  renderPath('/products/7')
  expect(
    await screen.findByText('Pantalla ficha de producto'),
  ).toBeInTheDocument()
})

const supplierEditorRoutes = ['/suppliers/new', '/suppliers/7/edit']

it.each(supplierEditorRoutes)(
  '%s abre la página del formulario de proveedor con proveedores.gestionar',
  async (path) => {
    currentSession = session(['proveedores.ver', 'proveedores.gestionar'])
    renderPath(path)
    expect(
      await screen.findByText('Pantalla editor de proveedor'),
    ).toBeInTheDocument()
  },
)

const longEditorRoutes: Array<[string, string, string]> = [
  ['/customers/new', 'clientes.gestionar', 'Pantalla editor de cliente'],
  ['/customers/7/edit', 'clientes.gestionar', 'Pantalla editor de cliente'],
  ['/vehicles/new', 'vehiculos.gestionar', 'Pantalla editor de vehículo'],
  ['/vehicles/7/edit', 'vehiculos.gestionar', 'Pantalla editor de vehículo'],
]

it.each(longEditorRoutes)(
  '%s abre su formulario de página con %s',
  async (path, permission, text) => {
    currentSession = session([permission])
    renderPath(path)
    expect(await screen.findByText(text)).toBeInTheDocument()
  },
)

it.each(longEditorRoutes)(
  '%s se deniega sin el permiso de gestión',
  async (path) => {
    currentSession = session(['clientes.ver', 'vehiculos.ver'])
    renderPath(path)
    expect(
      await screen.findByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeInTheDocument()
  },
)

it.each(supplierEditorRoutes)(
  '%s se deniega a quien solo puede consultar proveedores',
  async (path) => {
    currentSession = session(['proveedores.ver'])
    renderPath(path)
    expect(
      await screen.findByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeInTheDocument()
  },
)

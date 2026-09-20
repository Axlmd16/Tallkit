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
vi.mock('@/pages/purchases/PurchasesPage', () => ({
  PurchasesPage: stub('lista de ingresos'),
}))
vi.mock('@/pages/purchases/PurchaseEditorPage', () => ({
  PurchaseEditorPage: stub('editor de ingreso'),
}))
vi.mock('@/pages/purchases/PurchaseDetailPage', () => ({
  PurchaseDetailPage: stub('detalle de ingreso'),
}))
vi.mock('@/pages/inventory/InventoryPage', () => ({
  InventoryPage: stub('inventario'),
}))
vi.mock('@/pages/inventory/KardexPage', () => ({ KardexPage: stub('Kardex') }))
vi.mock('@/pages/inventory/InventoryOperationDetailPage', () => ({
  InventoryOperationDetailPage: stub('operación de inventario'),
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
  ['/purchases', 'ingresos.ver', 'Pantalla lista de ingresos'],
  ['/purchases/new', 'ingresos.crear', 'Pantalla editor de ingreso'],
  ['/purchases/7', 'ingresos.ver', 'Pantalla detalle de ingreso'],
  ['/purchases/7/edit', 'ingresos.crear', 'Pantalla editor de ingreso'],
  ['/inventory', 'inventario.ver', 'Pantalla inventario'],
  ['/inventory/products/3/kardex', 'inventario.ver', 'Pantalla Kardex'],
  [
    '/inventory/operations/9',
    'inventario.ver',
    'Pantalla operación de inventario',
  ],
]

it.each(routes)(
  '%s exige %s y responde con su pantalla',
  async (path, permission, text) => {
    currentSession = session([permission])
    renderPath(path)
    expect(await screen.findByText(text)).toBeInTheDocument()
  },
)

it.each(routes)('%s se deniega sin su permiso', async (path) => {
  currentSession = session(['productos.ver'])
  renderPath(path)
  expect(
    await screen.findByRole('heading', { name: 'Acceso no permitido' }),
  ).toBeInTheDocument()
})

it('la navegación muestra Ingresos e Inventario solo con su permiso', async () => {
  currentSession = session(['inventario.ver'])
  renderPath('/')
  expect(
    await screen.findByRole('link', { name: 'Inventario' }),
  ).toHaveAttribute('href', '/inventory')
  expect(screen.queryByRole('link', { name: 'Ingresos' })).toBeNull()
})

it('un Administrador ve ambas entradas', async () => {
  currentSession = session(['ingresos.ver', 'inventario.ver'])
  renderPath('/')
  expect(await screen.findByRole('link', { name: 'Ingresos' })).toHaveAttribute(
    'href',
    '/purchases',
  )
  expect(screen.getByRole('link', { name: 'Inventario' })).toBeInTheDocument()
})

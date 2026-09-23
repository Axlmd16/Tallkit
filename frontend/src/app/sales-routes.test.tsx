import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type { Session } from '@/features/auth/types'

import { isItemActive, navigationGroups } from './navigation'

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
vi.mock('@/pages/sales/SalesPage', () => ({
  SalesPage: stub('lista de ventas'),
}))
vi.mock('@/pages/sales/SaleEditorPage', () => ({
  SaleEditorPage: stub('editor de venta'),
}))
vi.mock('@/pages/sales/SaleDetailPage', () => ({
  SaleDetailPage: stub('detalle de venta'),
}))
vi.mock('@/pages/sales/SaleDocumentPage', () => ({
  SaleDocumentPage: stub('comprobante'),
}))
vi.mock('@/pages/sales/ReceivablesPage', () => ({
  ReceivablesPage: stub('cuentas por cobrar'),
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
  ['/sales', 'ventas.ver', 'Pantalla lista de ventas'],
  ['/sales/new', 'ventas.crear', 'Pantalla editor de venta'],
  ['/sales/7', 'ventas.ver', 'Pantalla detalle de venta'],
  ['/sales/7/edit', 'ventas.crear', 'Pantalla editor de venta'],
  ['/sales/7/document', 'ventas.ver', 'Pantalla comprobante'],
  [
    '/sales/receivables',
    'pagos_comerciales.ver',
    'Pantalla cuentas por cobrar',
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

it.each(routes)(
  '%s se deniega sin su permiso (el encargado sin rol comercial)',
  async (path) => {
    currentSession = session(['mantenimientos.ver', 'clientes.ver'])
    renderPath(path)
    expect(
      await screen.findByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeInTheDocument()
  },
)

it('la navegación muestra Ventas y Cuentas por cobrar solo con su permiso', async () => {
  currentSession = session(['ventas.ver'])
  renderPath('/')
  await userEvent.click(
    await screen.findByRole('button', { name: 'Ventas y cobros' }),
  )
  expect(
    await (await mainNav()).findByRole('link', { name: 'Ventas' }),
  ).toHaveAttribute('href', '/sales')
  expect(
    (await mainNav()).queryByRole('link', { name: 'Cuentas por cobrar' }),
  ).toBeNull()
})

it('un Vendedor con ambos permisos ve las dos entradas', async () => {
  currentSession = session(['ventas.ver', 'pagos_comerciales.ver'])
  renderPath('/')
  await userEvent.click(
    await screen.findByRole('button', { name: 'Ventas y cobros' }),
  )
  expect(
    await (await mainNav()).findByRole('link', { name: 'Cuentas por cobrar' }),
  ).toHaveAttribute('href', '/sales/receivables')
})

it('sin permisos comerciales el grupo no aparece', async () => {
  currentSession = session(['clientes.ver'])
  renderPath('/')
  await screen.findByRole('button', { name: 'Clientes y vehículos' })
  expect(screen.queryByRole('button', { name: 'Ventas y cobros' })).toBeNull()
})

it('Ventas no queda activa cuando se está en cuentas por cobrar', () => {
  const items = navigationGroups.find((g) => g.id === 'ventas-cobros')!.items
  const [sales, receivables] = items as [
    (typeof items)[number],
    (typeof items)[number],
  ]
  expect(isItemActive(sales, '/sales/receivables')).toBe(false)
  expect(isItemActive(receivables, '/sales/receivables')).toBe(true)
  expect(isItemActive(sales, '/sales/7/edit')).toBe(true)
})

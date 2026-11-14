import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type { Session } from '@/features/auth/types'

import { isSectionActive, navigationEntries } from './navigation'

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

const navHrefs = async () =>
  (await mainNav())
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))

it('la navegación muestra Ventas sin Cuentas si solo tiene ventas.ver', async () => {
  currentSession = session(['ventas.ver'])
  renderPath('/')
  await mainNav()
  expect(await navHrefs()).toContain('/sales')
  expect(await navHrefs()).not.toContain('/sales/receivables')
})

it('un Vendedor con ambos permisos llega a las cuentas de su negocio', async () => {
  currentSession = session(['ventas.ver', 'pagos_comerciales.ver'])
  renderPath('/')
  await mainNav()
  expect(await navHrefs()).toContain('/sales/receivables')
})

it('sin permisos comerciales no aparecen Ventas ni Cuentas', async () => {
  currentSession = session(['clientes.ver'])
  renderPath('/')
  await mainNav()
  expect(await navHrefs()).not.toContain('/sales')
  expect(await navHrefs()).not.toContain('/sales/receivables')
})

it('Ventas no queda activa cuando se está en cuentas por cobrar', () => {
  const sales = navigationEntries
    .find((entry) => entry.id === 'ventas')!
    .sections.find((section) => section.id === 'ventas')!
  const receivables = navigationEntries
    .find((entry) => entry.id === 'cuentas')!
    .sections.find((section) => section.scope === 'commercial')!
  expect(isSectionActive(sales, '/sales/receivables')).toBe(false)
  expect(isSectionActive(receivables, '/sales/receivables')).toBe(true)
  expect(isSectionActive(sales, '/sales/7/edit')).toBe(true)
})

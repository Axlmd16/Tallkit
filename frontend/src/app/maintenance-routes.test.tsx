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
vi.mock('@/pages/maintenance/MaintenanceOrdersPage', () => ({
  MaintenanceOrdersPage: stub('lista de órdenes'),
}))
vi.mock('@/pages/maintenance/MaintenanceOrderEditorPage', () => ({
  MaintenanceOrderEditorPage: stub('editor de orden'),
}))
vi.mock('@/pages/maintenance/MaintenanceOrderDetailPage', () => ({
  MaintenanceOrderDetailPage: stub('detalle de orden'),
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
  ['/maintenance', 'mantenimientos.ver', 'Pantalla lista de órdenes'],
  ['/maintenance/new', 'mantenimientos.gestionar', 'Pantalla editor de orden'],
  ['/maintenance/7', 'mantenimientos.ver', 'Pantalla detalle de orden'],
  [
    '/maintenance/7/edit',
    'mantenimientos.gestionar',
    'Pantalla editor de orden',
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
  '%s se deniega al Vendedor sin permisos del taller',
  async (path) => {
    currentSession = session(['ventas.ver', 'clientes.ver'])
    renderPath(path)
    expect(
      await screen.findByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeInTheDocument()
  },
)

it('la navegación muestra Mantenimientos solo con su permiso', async () => {
  currentSession = session(['mantenimientos.ver'])
  renderPath('/')
  const nav = within(
    await screen.findByRole('navigation', { name: 'Navegación principal' }),
  )
  expect(
    nav.getAllByRole('link').map((link) => link.getAttribute('href')),
  ).toContain('/maintenance')
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
vi.mock('@/pages/maintenance/ArtisanReceivablesPage', () => ({
  ArtisanReceivablesPage: stub('cobros de servicios'),
}))
vi.mock('@/pages/maintenance/ServiceOperationDetailPage', () => ({
  ServiceOperationDetailPage: stub('operación artesanal'),
}))
vi.mock('@/pages/maintenance/ServiceOperationDocumentPage', () => ({
  ServiceOperationDocumentPage: stub('comprobante artesanal'),
}))
vi.mock('@/pages/maintenance/CommercialOrderViewPage', () => ({
  CommercialOrderViewPage: stub('orden de origen'),
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
  [
    '/maintenance/receivables',
    'pagos_artesanales.ver',
    'Pantalla cobros de servicios',
  ],
  [
    '/maintenance/service-operations/4',
    'servicios_economicos.ver',
    'Pantalla operación artesanal',
  ],
  [
    '/maintenance/service-operations/4/document',
    'servicios_economicos.ver',
    'Pantalla comprobante artesanal',
  ],
  ['/maintenance/7/commercial', 'ventas.ver', 'Pantalla orden de origen'],
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
  currentSession = session(['clientes.ver'])
  renderPath(path)
  expect(
    await screen.findByRole('heading', { name: 'Acceso no permitido' }),
  ).toBeInTheDocument()
})

it('el Vendedor no accede a documentos ni cobros del RUC artesanal', async () => {
  currentSession = session(['ventas.ver', 'pagos_comerciales.ver'])
  renderPath('/maintenance/service-operations/4')
  expect(
    await screen.findByRole('heading', { name: 'Acceso no permitido' }),
  ).toBeInTheDocument()
})

it('la navegación ofrece Cobros de servicios solo con su permiso', async () => {
  currentSession = session(['mantenimientos.ver', 'pagos_artesanales.ver'])
  renderPath('/')
  const nav = within(
    await screen.findByRole('navigation', { name: 'Navegación principal' }),
  )
  if (!nav.queryByRole('link', { name: 'Cobros de servicios' })) {
    for (const button of nav.getAllByRole('button')) {
      await userEvent.click(button)
    }
  }
  expect(
    await nav.findByRole('link', { name: 'Cobros de servicios' }),
  ).toHaveAttribute('href', '/maintenance/receivables')
})

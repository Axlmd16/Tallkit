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
vi.mock('@/pages/workshop-configuration/WorkshopConfigurationPage', () => ({
  WorkshopConfigurationPage: () => 'Pantalla de configuración',
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

it('abre la configuración y sus pestañas solo con parametros.gestionar', async () => {
  currentSession = session(['parametros.gestionar'])
  renderPath('/configuration?tab=facturacion')
  expect(
    await screen.findByText('Pantalla de configuración'),
  ).toBeInTheDocument()
})

it.each([
  [
    'Vendedor',
    ['ventas.ver', 'fiscal.comercial.preparar', 'fiscal.comercial.ver'],
  ],
  [
    'Encargado',
    ['mantenimientos.ver', 'fiscal.artesanal.preparar', 'fiscal.artesanal.ver'],
  ],
])(
  'deniega al %s el enlace directo a Facturación electrónica aunque prepare datos fiscales',
  async (_role, permissions) => {
    currentSession = session(permissions)
    renderPath('/configuration?tab=facturacion')
    expect(
      await screen.findByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de configuración')).toBeNull()
  },
)

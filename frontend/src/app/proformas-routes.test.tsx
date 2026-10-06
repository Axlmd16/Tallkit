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
vi.mock('@/pages/proformas/ProformasPage', () => ({
  ProformasPage: stub('lista de proformas'),
}))
vi.mock('@/pages/proformas/ProformaEditorPage', () => ({
  ProformaEditorPage: stub('editor de proforma'),
}))
vi.mock('@/pages/proformas/ProformaDetailPage', () => ({
  ProformaDetailPage: stub('detalle de proforma'),
}))
vi.mock('@/pages/proformas/ProformaDocumentPage', () => ({
  ProformaDocumentPage: stub('documento de proforma'),
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
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<App router={router} />)
  return router
}

const COMMERCIAL = [
  'proformas.ver',
  'proformas.gestionar',
  'proformas.anular',
  'proformas.convertir',
]

beforeEach(() => {
  currentSession = session(COMMERCIAL)
})

it.each([
  ['/proformas', 'lista de proformas'],
  ['/proformas/new', 'editor de proforma'],
  ['/proformas/7', 'detalle de proforma'],
  ['/proformas/7/edit', 'editor de proforma'],
  ['/proformas/7/document', 'documento de proforma'],
])('%s muestra la pantalla %s', async (path, name) => {
  renderPath(path)
  expect(await screen.findByText(`Pantalla ${name}`)).toBeInTheDocument()
})

it('la navegación ofrece Proformas con permiso de consulta', async () => {
  renderPath('/')
  const nav = within(
    await screen.findByRole('navigation', { name: 'Navegación principal' }),
  )
  await userEvent.click(
    await nav.findByRole('button', { name: 'Ventas y cobros' }),
  )
  expect(await nav.findByRole('link', { name: 'Proformas' })).toHaveAttribute(
    'href',
    '/proformas',
  )
})

it.each(['/proformas', '/proformas/7', '/proformas/7/document'])(
  'el acceso directo a %s se protege sin permiso de consulta',
  async (path) => {
    currentSession = session(['mantenimientos.ver'])
    renderPath(path)
    expect(
      await screen.findByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Pantalla/)).toBeNull()
  },
)

it.each(['/proformas/new', '/proformas/7/edit'])(
  'consultar no basta para abrir el editor en %s',
  async (path) => {
    currentSession = session(['proformas.ver'])
    renderPath(path)
    expect(
      await screen.findByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Pantalla editor de proforma')).toBeNull()
  },
)

it('sin permiso de proformas el enlace no aparece', async () => {
  currentSession = session(['ventas.ver'])
  renderPath('/')
  const nav = within(
    await screen.findByRole('navigation', { name: 'Navegación principal' }),
  )
  await userEvent.click(
    await nav.findByRole('button', { name: 'Ventas y cobros' }),
  )
  expect(nav.queryByRole('link', { name: 'Proformas' })).toBeNull()
})

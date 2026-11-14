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

it('las pestañas de Ventas ofrecen Proformas con permiso de consulta', async () => {
  currentSession = session(['ventas.ver', 'proformas.ver'])
  renderPath('/sales')
  const tabs = within(
    await screen.findByRole('navigation', { name: 'Secciones de Ventas' }),
  )
  expect(
    tabs.getAllByRole('link').map((link) => link.getAttribute('href')),
  ).toContain('/proformas')
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

it('sin permiso de proformas no hay pestaña ni enlace', async () => {
  currentSession = session(['ventas.ver'])
  renderPath('/sales')
  await screen.findByRole('navigation', { name: 'Navegación principal' })
  expect(
    screen.queryByRole('navigation', { name: 'Secciones de Ventas' }),
  ).toBeNull()
  expect(
    screen.getAllByRole('link').map((link) => link.getAttribute('href')),
  ).not.toContain('/proformas')
})

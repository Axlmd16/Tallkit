import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { anonymousSession, type Session } from '@/features/auth/types'

let currentSession: Session = anonymousSession

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

import { App, appRoutes } from './App'

beforeEach(() => {
  currentSession = anonymousSession
})

function renderPath(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<App router={router} />)
}

it('redirects an expired session from a private route to login', async () => {
  renderPath('/users')

  expect(
    await screen.findByRole('heading', { name: 'Iniciar sesión' }),
  ).toBeInTheDocument()
})

it('forces a temporary credential through password replacement', async () => {
  currentSession = {
    authenticated: true,
    username: 'ana',
    roles: ['VENDEDOR'],
    permissions: [],
    must_change_password: true,
  }
  renderPath('/')

  expect(
    await screen.findByRole('heading', { name: 'Cambiar contraseña' }),
  ).toBeInTheDocument()
})

it('uses a functional authenticated home instead of the technical page', async () => {
  currentSession = {
    authenticated: true,
    username: 'venta',
    roles: ['VENDEDOR'],
    permissions: ['inventario.ver'],
    must_change_password: false,
  }
  renderPath('/')

  expect(
    await screen.findByRole('heading', { name: 'Inicio' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Estado técnico' }),
  ).not.toBeInTheDocument()
})

it('keeps technical diagnostics inaccessible without its permission', async () => {
  currentSession = {
    authenticated: true,
    username: 'venta',
    roles: ['VENDEDOR'],
    permissions: ['inventario.ver'],
    must_change_password: false,
  }
  renderPath('/technical-status')

  expect(
    await screen.findByRole('heading', { name: 'Acceso no permitido' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Estado técnico' }),
  ).not.toBeInTheDocument()
})

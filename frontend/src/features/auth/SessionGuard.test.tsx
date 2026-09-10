import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'

import { SessionGuard, type SessionState } from './SessionGuard'

function renderGuard(state: SessionState) {
  render(
    <MemoryRouter initialEntries={['/private']}>
      <Routes>
        <Route element={<SessionGuard state={state} />}>
          <Route path="private" element={<p>Contenido privado</p>} />
        </Route>
        <Route path="login" element={<p>Acceso</p>} />
        <Route path="change-password" element={<p>Cambiar contraseña</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

it('shows a stable loading state while the session is resolved', () => {
  renderGuard({ status: 'loading' })

  expect(screen.getByText('Comprobando sesión…')).toBeInTheDocument()
})

it('redirects an anonymous or invalidated session to login', () => {
  renderGuard({
    status: 'ready',
    session: {
      authenticated: false,
      username: null,
      roles: [],
      permissions: [],
      must_change_password: false,
    },
  })

  expect(screen.getByText('Acceso')).toBeInTheDocument()
})

it('allows an authenticated session to reach the requested route', () => {
  renderGuard({
    status: 'ready',
    session: {
      authenticated: true,
      username: 'ana',
      roles: ['VENDEDOR'],
      permissions: ['ventas.crear'],
      must_change_password: false,
    },
  })

  expect(screen.getByText('Contenido privado')).toBeInTheDocument()
})

it('redirects a temporary credential to mandatory password change', () => {
  renderGuard({
    status: 'ready',
    session: {
      authenticated: true,
      username: 'ana',
      roles: ['VENDEDOR'],
      permissions: [],
      must_change_password: true,
    },
  })

  expect(screen.getByText('Cambiar contraseña')).toBeInTheDocument()
})

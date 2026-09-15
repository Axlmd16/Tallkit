import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'

import type { Session } from '@/features/auth/types'

import { AuthenticatedShell } from './AuthenticatedShell'

const cases: Array<[string, Session, boolean]> = [
  [
    'Administrador',
    {
      authenticated: true,
      username: 'admin',
      roles: ['ADMINISTRADOR'],
      permissions: ['usuarios.ver', 'auditoria.ver', 'operacion.ver_estado'],
      must_change_password: false,
    },
    true,
  ],
  [
    'Vendedor',
    {
      authenticated: true,
      username: 'venta',
      roles: ['VENDEDOR'],
      permissions: ['ventas.ver', 'inventario.ver'],
      must_change_password: false,
    },
    false,
  ],
  [
    'Encargado del taller',
    {
      authenticated: true,
      username: 'taller',
      roles: ['ENCARGADO_TALLER'],
      permissions: ['mantenimientos.ver', 'inventario.ver'],
      must_change_password: false,
    },
    false,
  ],
]

it.each(cases)(
  'derives navigation for %s only from session permissions',
  (_, session, isAdmin) => {
    render(
      <MemoryRouter>
        <AuthenticatedShell onLogout={vi.fn()} session={session}>
          <p>Contenido</p>
        </AuthenticatedShell>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios' })).toBe(
      isAdmin ? screen.getByRole('link', { name: 'Usuarios' }) : null,
    )
    expect(screen.queryByRole('link', { name: 'Auditoría' })).toBe(
      isAdmin ? screen.getByRole('link', { name: 'Auditoría' }) : null,
    )
  },
)

it('shows every assigned role but does not infer navigation from role names', () => {
  render(
    <MemoryRouter>
      <AuthenticatedShell
        onLogout={vi.fn()}
        session={{
          authenticated: true,
          username: 'operador',
          roles: ['VENDEDOR', 'ENCARGADO_TALLER'],
          permissions: ['ventas.ver', 'mantenimientos.ver'],
          must_change_password: false,
        }}
      >
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  expect(
    screen.getByText('operador · Vendedor · Encargado del taller'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Usuarios' }),
  ).not.toBeInTheDocument()
})

it('keeps logout available and prevents duplicate submissions', async () => {
  let finish!: () => void
  const onLogout = vi.fn(
    () => new Promise<void>((resolve) => (finish = resolve)),
  )
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AuthenticatedShell onLogout={onLogout} session={cases[1]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  const button = screen.getByRole('button', { name: 'Cerrar sesión' })
  await user.click(button)
  await user.click(button)

  expect(onLogout).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled()
  finish()
})

it('marks the current location in the authorized navigation', () => {
  render(
    <MemoryRouter initialEntries={['/users']}>
      <AuthenticatedShell onLogout={vi.fn()} session={cases[0]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('keeps the brand title constrained and aligns expanded navigation to the rail edge', () => {
  render(
    <MemoryRouter>
      <AuthenticatedShell onLogout={vi.fn()} session={cases[0]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  const navigationLink = screen.getByRole('link', { name: 'Inicio' })

  expect(navigationLink).toHaveClass('app-rail-nav-item')
  expect(screen.getByTestId('brand-logo-expanded')).toHaveAttribute(
    'src',
    '/src/assets/brand/secundario.svg',
  )
  expect(screen.getByTestId('brand-logo-compact')).toHaveAttribute(
    'src',
    '/src/assets/brand/isotipo.svg',
  )
})

it('opens compact navigation and closes it after choosing a route', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AuthenticatedShell onLogout={vi.fn()} session={cases[0]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  const opener = screen.getByRole('button', { name: 'Abrir navegación' })
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Navegación principal' })
  expect(
    within(dialog).getByRole('button', { name: 'Cerrar panel' }),
  ).toBeEnabled()
  await user.click(within(dialog).getByRole('link', { name: 'Auditoría' }))

  expect(
    screen.queryByRole('dialog', { name: 'Navegación principal' }),
  ).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

it('shows Clientes navigation when session includes clientes.ver permission', () => {
  render(
    <MemoryRouter>
      <AuthenticatedShell
        onLogout={vi.fn()}
        session={{
          authenticated: true,
          username: 'vendedor',
          roles: ['VENDEDOR'],
          permissions: ['clientes.ver'],
          must_change_password: false,
        }}
      >
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
})

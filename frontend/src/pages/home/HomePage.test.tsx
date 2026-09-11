import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'

const permissions = vi.hoisted(() => [] as string[])

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions } }),
}))

import { HomePage } from './HomePage'

it('offers only real destinations granted by the effective permissions', () => {
  permissions.splice(0, permissions.length, 'usuarios.ver', 'auditoria.ver')
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: /Usuarios/ })).toBeVisible()
  expect(screen.getByRole('link', { name: /Auditoría/ })).toBeVisible()
  expect(
    screen.queryByRole('link', { name: /Estado técnico/ }),
  ).not.toBeInTheDocument()
})

it('does not invent dashboard metrics when no destination is available', () => {
  permissions.splice(0)
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )

  expect(
    screen.getByText('No hay accesos adicionales disponibles.'),
  ).toBeVisible()
  expect(
    screen.queryByText(/ventas de hoy|ingresos|productos/i),
  ).not.toBeInTheDocument()
})

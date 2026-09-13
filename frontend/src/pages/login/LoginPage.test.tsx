import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mutateAsync = vi.fn()

vi.mock('@/features/auth/hooks', () => ({
  useLogin: () => ({ mutateAsync }),
}))

import { LoginPage } from './LoginPage'

beforeEach(() => mutateAsync.mockReset())

it('uses a split workshop composition without public registration or social access', () => {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )

  expect(screen.getByTestId('login-layout')).toBeVisible()
  expect(screen.getByTestId('login-visual')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  expect(
    screen.queryByText(/Google|Facebook|Crear cuenta/i),
  ).not.toBeInTheDocument()
})

it('navigates to the authenticated start after a successful login', async () => {
  mutateAsync.mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="/" element={<p>Inicio autenticado</p>} />
      </Routes>
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Identificación de acceso'), 'ana')
  await user.type(screen.getByLabelText('Contraseña'), 'secreta')
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))

  expect(mutateAsync).toHaveBeenCalledWith({
    username: 'ana',
    password: 'secreta',
  })
  expect(await screen.findByText('Inicio autenticado')).toBeInTheDocument()
})

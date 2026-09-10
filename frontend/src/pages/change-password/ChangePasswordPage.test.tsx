import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mutateAsync = vi.fn()

vi.mock('@/features/auth/hooks', () => ({
  useChangePassword: () => ({ mutateAsync }),
}))

import { ChangePasswordPage } from './ChangePasswordPage'

beforeEach(() => mutateAsync.mockReset())

it('returns to the authenticated start after replacing a temporary password', async () => {
  mutateAsync.mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/change-password']}>
      <Routes>
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="/" element={<p>Inicio autenticado</p>} />
      </Routes>
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Contraseña actual'), 'temporal')
  await user.type(
    screen.getByLabelText('Nueva contraseña'),
    'Nueva-segura-2026',
  )
  await user.type(
    screen.getByLabelText('Confirmar nueva contraseña'),
    'Nueva-segura-2026',
  )
  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

  expect(mutateAsync).toHaveBeenCalledWith({
    currentPassword: 'temporal',
    newPassword: 'Nueva-segura-2026',
  })
  expect(await screen.findByText('Inicio autenticado')).toBeInTheDocument()
})

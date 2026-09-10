import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

import { ChangePasswordForm, LoginForm } from './AuthForms'

it('submits login by keyboard and prevents a duplicate pending submission', async () => {
  let finish!: () => void
  const onLogin = vi.fn(
    () => new Promise<void>((resolve) => (finish = resolve)),
  )
  const user = userEvent.setup()
  render(<LoginForm onLogin={onLogin} />)

  await user.click(screen.getByLabelText('Identificación de acceso'))
  await user.keyboard('operador')
  await user.tab()
  await user.keyboard('secreta')
  await user.keyboard('{Enter}{Enter}')

  expect(onLogin).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Ingresando…' })).toBeDisabled()
  finish()
})

it('shows a generic login error and keeps the entered identifier', async () => {
  const onLogin = vi
    .fn()
    .mockRejectedValue(
      new ProblemError(
        'Las credenciales no son válidas.',
        400,
        'invalid_credentials',
      ),
    )
  const user = userEvent.setup()
  render(<LoginForm onLogin={onLogin} />)

  await user.type(screen.getByLabelText('Identificación de acceso'), 'operador')
  await user.type(screen.getByLabelText('Contraseña'), 'incorrecta')
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Las credenciales no son válidas.',
  )
  expect(screen.getByLabelText('Identificación de acceso')).toHaveValue(
    'operador',
  )
})

it('validates confirmation before changing a password', async () => {
  const onChangePassword = vi.fn().mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(<ChangePasswordForm onChangePassword={onChangePassword} />)

  await user.type(screen.getByLabelText('Contraseña actual'), 'anterior')
  await user.type(
    screen.getByLabelText('Nueva contraseña'),
    'Nueva-segura-2026',
  )
  await user.type(
    screen.getByLabelText('Confirmar nueva contraseña'),
    'distinta',
  )
  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Las contraseñas nuevas no coinciden.',
  )
  expect(onChangePassword).not.toHaveBeenCalled()
})

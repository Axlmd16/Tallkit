import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

import { UserForm } from './UserForm'

it('requires a role and preserves entered data after a server error', async () => {
  const save = vi
    .fn()
    .mockRejectedValue(
      new ProblemError('Identificación repetida.', 400, 'duplicate_username'),
    )
  const user = userEvent.setup()
  render(<UserForm onSubmit={save} />)

  await user.type(screen.getByLabelText('Identificación de acceso'), 'ana')
  await user.click(screen.getByRole('button', { name: 'Guardar usuario' }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Seleccione al menos un rol.',
  )
  expect(save).not.toHaveBeenCalled()

  await user.click(screen.getByLabelText('Vendedor'))
  await user.click(screen.getByRole('button', { name: 'Guardar usuario' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Identificación repetida.',
  )
  expect(screen.getByLabelText('Identificación de acceso')).toHaveValue('ana')
})

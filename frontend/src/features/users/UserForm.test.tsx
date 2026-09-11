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
  expect(
    screen.getByRole('group', { name: 'Roles' }),
  ).toHaveAccessibleDescription('Seleccione al menos un rol.')
  expect(save).not.toHaveBeenCalled()

  await user.click(screen.getByLabelText('Vendedor'))
  await user.click(screen.getByRole('button', { name: 'Guardar usuario' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Identificación repetida.',
  )
  expect(screen.getByLabelText('Identificación de acceso')).toHaveValue('ana')
})

it('keeps a logical single-column order before expanding the field grid', () => {
  render(<UserForm onSubmit={vi.fn()} />)

  expect(screen.getByTestId('user-fields')).toHaveClass(
    'grid-cols-1',
    'md:grid-cols-2',
  )
  expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  for (const checkbox of screen.getAllByRole('checkbox')) {
    expect(checkbox.closest('label')).toHaveClass('min-h-11')
  }
})

it('warns the browser when navigating away with unsaved changes', async () => {
  const user = userEvent.setup()
  render(<UserForm onSubmit={vi.fn()} />)
  await user.type(screen.getByLabelText('Nombres'), 'Ana')

  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)

  expect(event.defaultPrevented).toBe(true)
})

it('reports dirty state to the containing drawer', async () => {
  const onDirtyChange = vi.fn()
  const user = userEvent.setup()
  render(<UserForm onDirtyChange={onDirtyChange} onSubmit={vi.fn()} />)

  await user.type(screen.getByLabelText('Nombres'), 'Ana')

  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
})

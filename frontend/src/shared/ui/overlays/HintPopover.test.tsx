import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import { HintPopover } from './HintPopover'

function renderHint() {
  return render(
    <HintPopover
      description="Aviso permanente."
      label="2 pendientes"
      trigger="2"
    >
      Falta el punto predeterminado.
    </HintPopover>,
  )
}

it('describe el disparador siempre y despliega el detalle con puntero y foco', async () => {
  const user = userEvent.setup()
  renderHint()

  const trigger = screen.getByRole('button', { name: '2 pendientes' })
  expect(trigger).toHaveAccessibleDescription('Aviso permanente.')
  expect(screen.queryByRole('note')).toBeNull()

  await user.hover(trigger)
  expect(screen.getByRole('note')).toHaveTextContent(
    'Falta el punto predeterminado.',
  )
  await user.unhover(trigger)
  expect(screen.queryByRole('note')).toBeNull()

  await user.tab()
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('note')).toBeNull()
})

it('se fija con un toque o clic y se cierra al tocar fuera', async () => {
  const user = userEvent.setup()
  renderHint()

  await user.click(screen.getByRole('button', { name: '2 pendientes' }))
  await user.unhover(screen.getByRole('button', { name: '2 pendientes' }))
  expect(screen.getByRole('note')).toBeVisible()
  await user.click(document.body)
  expect(screen.queryByRole('note')).toBeNull()
})

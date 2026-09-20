import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'

import { Drawer } from '@/shared/ui'

import { useReturnFocus } from './useReturnFocus'

function Harness() {
  const [open, setOpen] = useState(false)
  const returnFocus = useReturnFocus(open)
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Abrir panel
      </button>
      <Drawer
        description="Panel de prueba"
        onClose={() => setOpen(false)}
        open={open}
        returnFocusRef={returnFocus}
        title="Panel"
      >
        <button type="button">Dentro</button>
      </Drawer>
    </>
  )
}

it('devuelve el foco al control que abrió el panel', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Abrir panel' })
  await user.click(trigger)
  expect(
    await screen.findByRole('dialog', { name: 'Panel' }),
  ).toBeInTheDocument()
  await user.keyboard('{Escape}')
  await Promise.resolve()
  expect(trigger).toHaveFocus()
})

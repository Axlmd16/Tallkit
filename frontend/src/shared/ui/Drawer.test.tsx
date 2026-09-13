import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { expect, it } from 'vitest'

import { Button } from './controls'
import { Drawer } from './Drawer'

function ExampleDrawer({ dirty = false }: { dirty?: boolean }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button onClick={() => setOpen(true)} ref={triggerRef}>
        Editar usuario
      </Button>
      <Drawer
        description="Actualice los datos autorizados."
        hasUnsavedChanges={dirty}
        onClose={() => setOpen(false)}
        open={open}
        returnFocusRef={triggerRef}
        title="Datos del usuario"
      >
        <label>
          Nombres
          <input data-autofocus />
        </label>
        <Button>Guardar</Button>
      </Drawer>
    </>
  )
}

it('moves focus into the drawer, traps it and returns it after Escape', async () => {
  const user = userEvent.setup()
  render(<ExampleDrawer />)
  const trigger = screen.getByRole('button', { name: 'Editar usuario' })

  await user.click(trigger)
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Nombres' })).toHaveFocus(),
  )
  await user.keyboard('{Escape}')

  expect(
    screen.queryByRole('dialog', { name: 'Datos del usuario' }),
  ).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('warns before discarding unsaved changes', async () => {
  const user = userEvent.setup()
  render(<ExampleDrawer dirty />)

  await user.click(screen.getByRole('button', { name: 'Editar usuario' }))
  await user.keyboard('{Escape}')

  expect(screen.getByRole('alert')).toHaveTextContent('Hay cambios sin guardar')
  await user.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { expect, it, vi } from 'vitest'

import { Button } from './controls'
import { Dialog } from './Dialog'

function ExampleDialog() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button onClick={() => setOpen(true)} ref={triggerRef}>
        Desactivar usuario
      </Button>
      <Dialog
        description="El usuario perderá el acceso al sistema."
        onClose={() => setOpen(false)}
        open={open}
        returnFocusRef={triggerRef}
        title="Confirmar desactivación"
      >
        <Button data-autofocus variant="danger">
          Confirmar desactivación
        </Button>
        <Button onClick={() => setOpen(false)} variant="secondary">
          Conservar usuario
        </Button>
      </Dialog>
    </>
  )
}

it('moves focus into the dialog and exposes its consequence', async () => {
  const user = userEvent.setup()
  render(<ExampleDialog />)

  await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }))

  expect(
    screen.getByRole('dialog', { name: 'Confirmar desactivación' }),
  ).toHaveAccessibleDescription('El usuario perderá el acceso al sistema.')
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Confirmar desactivación' }),
    ).toHaveFocus(),
  )
})

it('closes with Escape and returns focus to the opening control', async () => {
  const user = userEvent.setup()
  render(<ExampleDialog />)
  const trigger = screen.getByRole('button', { name: 'Desactivar usuario' })

  await user.click(trigger)
  await user.keyboard('{Escape}')

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('keeps tab focus inside while the dialog is open', async () => {
  const user = userEvent.setup()
  render(<ExampleDialog />)
  await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }))

  const last = screen.getByRole('button', { name: 'Conservar usuario' })
  last.focus()
  await user.tab()

  expect(
    screen.getByRole('button', { name: 'Confirmar desactivación' }),
  ).toHaveFocus()
})

it('usa el lenguaje Tallkit sin ilustraciones de la plantilla y marca el peligro', () => {
  render(
    <Dialog
      description="Se conservan el número y los valores originales."
      onClose={() => undefined}
      open
      title="Anular venta"
      tone="danger"
    >
      <Button variant="danger-solid">Anular venta</Button>
    </Dialog>,
  )
  const dialog = screen.getByRole('dialog', { name: 'Anular venta' })
  expect(dialog.querySelector('img')).toBeNull()
  expect(dialog.className).toMatch(/rounded-dialog/)
  expect(dialog).toHaveAttribute('data-tone', 'danger')
})

it('Escape cierra aunque el foco siga fuera del panel', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <>
      <button type="button">Detrás</button>
      <Dialog description="d" onClose={onClose} open title="Registrar cobro">
        <Button>Registrar cobro</Button>
      </Dialog>
    </>,
  )
  screen.getByText('Detrás').focus()
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

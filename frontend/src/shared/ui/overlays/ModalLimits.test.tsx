import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Button } from '../controls'
import { Dialog } from '../Dialog'
import { Drawer } from '../Drawer'

function NestedModalsExample() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const drawerTriggerRef = useRef<HTMLButtonElement>(null)
  const dialogTriggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      <Button onClick={() => setDrawerOpen(true)} ref={drawerTriggerRef}>
        Abrir cajón
      </Button>

      <Drawer
        description="Cajón con acción modal anidada"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        returnFocusRef={drawerTriggerRef}
        title="Cajón Principal"
      >
        <p>Texto dentro del cajón</p>
        <Button onClick={() => setDialogOpen(true)} ref={dialogTriggerRef}>
          Abrir diálogo anidado
        </Button>

        <Dialog
          description="Confirmación anidada sobre cajón"
          onClose={() => setDialogOpen(false)}
          open={dialogOpen}
          returnFocusRef={dialogTriggerRef}
          title="Diálogo Anidado"
        >
          <Button onClick={() => setDialogOpen(false)}>Cerrar diálogo</Button>
        </Dialog>
      </Drawer>
    </div>
  )
}

function EmptyControlsModal() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <Button onClick={() => setOpen(true)}>Abrir sin controles</Button>
      <Dialog
        description="Diálogo meramente informativo sin controles"
        onClose={() => setOpen(false)}
        open={open}
        title="Solo Texto"
      >
        <p>Aviso informativo estático.</p>
      </Dialog>
    </div>
  )
}

describe('Límites de foco, scroll y anidación en Drawer y Dialog (Fase 9.2)', () => {
  it('makes the page and lower modal surface inert while the top modal is open', async () => {
    const user = userEvent.setup()
    const { container } = render(<NestedModalsExample />)

    const pageRoot = container
    const drawerTrigger = screen.getByRole('button', { name: 'Abrir cajón' })
    await user.click(drawerTrigger)

    expect(pageRoot).toHaveAttribute('inert')
    expect(pageRoot).toHaveAttribute('aria-hidden', 'true')

    const openNestedButton = screen.getByRole('button', {
      name: 'Abrir diálogo anidado',
    })
    await user.click(openNestedButton)

    expect(openNestedButton).toHaveAttribute('inert')
    expect(openNestedButton).toHaveAttribute('aria-hidden', 'true')

    await user.keyboard('{Escape}')

    expect(openNestedButton).not.toHaveAttribute('inert')
    expect(openNestedButton).not.toHaveAttribute('aria-hidden')
    expect(pageRoot).toHaveAttribute('inert')

    await user.keyboard('{Escape}')

    expect(pageRoot).not.toHaveAttribute('inert')
    expect(pageRoot).not.toHaveAttribute('aria-hidden')
  })

  it('manages nested modals preserving body overflow and focus hierarchy', async () => {
    const user = userEvent.setup()
    render(<NestedModalsExample />)

    // Inicialmente el body no tiene overflow hidden
    expect(document.body.style.overflow).toBe('')

    // Abrir cajón principal
    await user.click(screen.getByRole('button', { name: 'Abrir cajón' }))
    expect(document.body.style.overflow).toBe('hidden')
    expect(
      screen.getByRole('dialog', { name: 'Cajón Principal' }),
    ).toBeVisible()

    // Abrir diálogo anidado desde dentro del cajón
    const openNestedBtn = screen.getByRole('button', {
      name: 'Abrir diálogo anidado',
    })
    await user.click(openNestedBtn)
    expect(document.body.style.overflow).toBe('hidden')

    const nestedDialog = screen.getByRole('dialog', { name: 'Diálogo Anidado' })
    expect(nestedDialog).toBeVisible()

    // Cerrar diálogo anidado con Escape
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Diálogo Anidado' }),
    ).not.toBeInTheDocument()

    // El cajón principal sigue abierto y el foco regresa al botón disparador del diálogo
    expect(
      screen.getByRole('dialog', { name: 'Cajón Principal' }),
    ).toBeVisible()
    await waitFor(() => expect(openNestedBtn).toHaveFocus())

    // El scroll sigue bloqueado porque el cajón sigue abierto
    expect(document.body.style.overflow).toBe('hidden')

    // Cerrar cajón principal
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Cajón Principal' }),
    ).not.toBeInTheDocument()

    // Scroll restablecido en el body
    expect(document.body.style.overflow).toBe('')
  })

  it('handles absence of interactive controls without throwing errors on tab', async () => {
    const user = userEvent.setup()
    render(<EmptyControlsModal />)

    await user.click(
      screen.getByRole('button', { name: 'Abrir sin controles' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Solo Texto' })
    expect(dialog).toBeVisible()

    // Presionar Tab no debe causar excepciones aunque no haya controles interactivos
    await user.tab()
    expect(dialog).toBeVisible()

    // Escape cierra limpiamente
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Solo Texto' }),
    ).not.toBeInTheDocument()
  })
})

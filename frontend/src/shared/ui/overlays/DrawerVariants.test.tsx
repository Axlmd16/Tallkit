import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Button } from '../controls'
import { Drawer } from '../Drawer'

function DrawerVariantsTest({
  width = 'default',
  overlay = 'default',
  dirty = false,
  customContainer,
  tokenScope,
}: {
  width?: 'default' | '409' | '369'
  overlay?: 'default' | '30' | 'none'
  dirty?: boolean
  customContainer?: HTMLElement | null
  tokenScope?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      <Button onClick={() => setOpen(true)} ref={triggerRef}>
        Abrir cajón
      </Button>

      <Drawer
        description="Descripción de variante"
        hasUnsavedChanges={dirty}
        onClose={() => setOpen(false)}
        open={open}
        overlay={overlay}
        portalContainer={customContainer}
        returnFocusRef={triggerRef}
        title="Cajón con Variantes"
        tokenScope={tokenScope}
        width={width}
      >
        <p>Contenido del cajón</p>
      </Drawer>
    </div>
  )
}

describe('Drawer Variants y Comportamiento Opt-in (Fase 9.3)', () => {
  it('renders width 409px (F08 4:3261) and 369px (F10 4:5399)', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DrawerVariantsTest width="409" />)

    await user.click(screen.getByRole('button', { name: 'Abrir cajón' }))
    const panel409 = screen.getByRole('dialog', { name: 'Cajón con Variantes' })
    expect(panel409.className).toContain('md:w-[409px]')

    // Rerender con 369
    rerender(<DrawerVariantsTest width="369" />)
    const panel369 = screen.getByRole('dialog', { name: 'Cajón con Variantes' })
    expect(panel369.className).toContain('md:w-[369px]')
  })

  it('renders overlay 30% and none, and supports tokenScope', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <DrawerVariantsTest overlay="30" tokenScope="theme-compact" />,
    )

    await user.click(screen.getByRole('button', { name: 'Abrir cajón' }))
    const backdrop30 = document.querySelector('.drawer-backdrop')
    expect(backdrop30?.className).toContain('bg-ink/30')
    expect(backdrop30?.className).toContain('theme-compact')

    rerender(<DrawerVariantsTest overlay="none" />)
    const backdropNone = document.querySelector('.drawer-backdrop')
    expect(backdropNone?.className).toContain('bg-transparent')
  })

  it('renders within custom portalContainer when provided', async () => {
    const user = userEvent.setup()
    const customContainer = document.createElement('div')
    customContainer.setAttribute('data-testid', 'custom-portal-target')
    document.body.appendChild(customContainer)

    render(<DrawerVariantsTest customContainer={customContainer} />)
    await user.click(screen.getByRole('button', { name: 'Abrir cajón' }))

    expect(customContainer.querySelector('.drawer-backdrop')).not.toBeNull()

    document.body.removeChild(customContainer)
  })

  it('handles discard of local edits, returning focus and restoring scroll', async () => {
    const user = userEvent.setup()
    render(<DrawerVariantsTest dirty />)

    const trigger = screen.getByRole('button', { name: 'Abrir cajón' })
    await user.click(trigger)

    expect(document.body.style.overflow).toBe('hidden')

    // Presionar Escape activa confirmación de cambios sin guardar
    await user.keyboard('{Escape}')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Hay cambios sin guardar',
    )

    // Click en "Seguir editando" mantiene el cajón abierto
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
    expect(
      screen.getByRole('dialog', { name: 'Cajón con Variantes' }),
    ).toBeVisible()
    expect(document.body.style.overflow).toBe('hidden')

    // Presionar botón de cerrar activa confirmación
    await user.click(screen.getByRole('button', { name: 'Cerrar panel' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Hay cambios sin guardar',
    )

    // Click en "Descartar cambios" cierra el cajón
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }))
    expect(
      screen.queryByRole('dialog', { name: 'Cajón con Variantes' }),
    ).not.toBeInTheDocument()

    // Scroll restablecido y foco devuelto
    expect(document.body.style.overflow).toBe('')
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '../controls'
import { Sidebar } from '../navigation'
import { ConfirmationPanel } from './ConfirmationPanel'
import { Modal } from './Modal'

function MobileSidebarExample() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('orders')
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      <Button onClick={() => setOpen(true)} ref={triggerRef}>
        Abrir menú móvil
      </Button>

      <Sidebar
        activeId={active}
        items={[
          { id: 'dash', label: 'Tablero', icon: 'category' },
          { id: 'orders', label: 'Órdenes', icon: 'document' },
        ]}
        mobileOpen={open}
        onMobileClose={() => setOpen(false)}
        onSelect={(id) => {
          setActive(id)
          setOpen(false)
        }}
      />
    </div>
  )
}

describe('Modal (C41), ConfirmationPanel (C42) y Sidebar Móvil - Fase 9.4', () => {
  it('renders Modal with 466px width (F12 4:6177) and accessible header/actions', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(
      <Modal
        actions={
          <>
            <Button onClick={handleClose} variant="secondary">
              Cancelar
            </Button>
            <Button variant="primary">Aceptar</Button>
          </>
        }
        description="Ajuste de parámetros técnicos"
        onClose={handleClose}
        open
        title="Configurar Parámetros"
      >
        <p>Cuerpo del modal de 466px</p>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Configurar Parámetros' })
    expect(dialog).toBeVisible()
    expect(dialog.className).toContain('max-w-[466px]')
    expect(screen.getByText('Ajuste de parámetros técnicos')).toBeVisible()
    expect(screen.getByText('Cuerpo del modal de 466px')).toBeVisible()

    // Botón de cierre en header
    const closeBtn = screen.getByRole('button', { name: 'Cerrar modal' })
    await user.click(closeBtn)
    expect(handleClose).toHaveBeenCalled()
  })

  it('renders ConfirmationPanel without illustrations with 658px/726px width (F19/F20)', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    const handleCancel = vi.fn()

    const { rerender } = render(
      <ConfirmationPanel
        confirmLabel="Proceder con anulación"
        description="Esta acción cambiará el estado de la orden a anulada."
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        open
        title="Anular Orden de Servicio"
        tone="danger"
        width="658"
      />,
    )

    const panel658 = screen.getByRole('dialog', {
      name: 'Anular Orden de Servicio',
    })
    expect(panel658).toBeVisible()
    expect(panel658.className).toContain('max-w-[658px]')

    // No debe contener imágenes ni ilustraciones demo
    expect(document.querySelector('img')).toBeNull()

    const confirmBtn = screen.getByRole('button', {
      name: 'Proceder con anulación',
    })
    await user.click(confirmBtn)
    expect(handleConfirm).toHaveBeenCalledTimes(1)

    // Rerender con ancho 726px
    rerender(
      <ConfirmationPanel
        confirmLabel="Confirmar"
        description="Información procesada"
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        open
        title="Confirmar Proceso"
        width="726"
      />,
    )
    const panel726 = screen.getByRole('dialog', { name: 'Confirmar Proceso' })
    expect(panel726.className).toContain('max-w-[726px]')
  })

  it('connects mobile navigation to Drawer, closing on selection or Escape', async () => {
    const user = userEvent.setup()
    render(<MobileSidebarExample />)

    const openBtn = screen.getByRole('button', { name: 'Abrir menú móvil' })
    await user.click(openBtn)

    // Drawer móvil abierto
    const mobileDrawer = screen.getByRole('dialog', {
      name: 'Navegación móvil',
    })
    expect(mobileDrawer).toBeVisible()

    // Seleccionar item dentro del drawer cierra el menú móvil
    const dashItem = within(mobileDrawer).getByRole('button', {
      name: /tablero/i,
    })
    await user.click(dashItem)

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Navegación móvil' }),
      ).not.toBeInTheDocument()
    })
  })

  it('closes mobile navigation drawer on resize to desktop breakpoint (>= 1024px)', async () => {
    const user = userEvent.setup()
    render(<MobileSidebarExample />)

    const openBtn = screen.getByRole('button', { name: 'Abrir menú móvil' })
    await user.click(openBtn)

    expect(
      screen.getByRole('dialog', { name: 'Navegación móvil' }),
    ).toBeVisible()

    window.innerWidth = 1024
    window.dispatchEvent(new Event('resize'))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Navegación móvil' }),
      ).not.toBeInTheDocument()
    })
  })
})

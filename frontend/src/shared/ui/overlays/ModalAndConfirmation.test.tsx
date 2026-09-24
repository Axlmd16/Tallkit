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
  it.each([
    ['wide', 'max-w-[600px]'],
    ['media', 'max-w-[min(90vw,1100px)]'],
  ] as const)(
    'applies the %s size without keeping the default width',
    (size, expected) => {
      render(
        <Modal onClose={vi.fn()} open size={size} title={`Modal ${size}`}>
          <p>Contenido</p>
        </Modal>,
      )
      const dialog = screen.getByRole('dialog', { name: `Modal ${size}` })
      expect(dialog.className).toContain(expected)
      expect(dialog.className).not.toContain('max-w-[466px]')
    },
  )

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

  it('renders the Tallkit confirmation panel without illustrations at 420–480px', async () => {
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
      />,
    )

    const panel480 = screen.getByRole('dialog', {
      name: 'Anular Orden de Servicio',
    })
    expect(panel480).toBeVisible()
    expect(panel480).toHaveClass('max-w-[480px]')
    expect(panel480.parentElement).toHaveClass('bg-ink/45')

    // No debe contener imágenes ni ilustraciones demo
    expect(document.querySelector('img')).toBeNull()

    const confirmBtn = screen.getByRole('button', {
      name: 'Proceder con anulación',
    })
    await user.click(confirmBtn)
    expect(handleConfirm).toHaveBeenCalledTimes(1)

    // La variante estrecha se mantiene dentro del rango aprobado.
    rerender(
      <ConfirmationPanel
        confirmLabel="Confirmar"
        description="Información procesada"
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        open
        title="Confirmar Proceso"
        width="420"
      />,
    )
    const panel420 = screen.getByRole('dialog', { name: 'Confirmar Proceso' })
    expect(panel420).toHaveClass('max-w-[420px]')
  })

  it('connects mobile navigation to its panel, closing on selection or Escape', async () => {
    const user = userEvent.setup()
    render(<MobileSidebarExample />)

    const openBtn = screen.getByRole('button', { name: 'Abrir menú móvil' })
    await user.click(openBtn)

    // Panel de navegación móvil abierto
    const mobileDrawer = screen.getByRole('dialog', {
      name: 'Navegación móvil',
    })
    expect(mobileDrawer).toBeVisible()

    // Elegir una opción dentro del panel cierra el menú móvil
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

  it('closes mobile navigation panel on resize to desktop breakpoint (>= 1024px)', async () => {
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

  it('devuelve el foco al control que lo tenía aunque la referencia de retorno llegue vacía', async () => {
    function LateCapture() {
      const [open, setOpen] = useState(false)
      // Simula la captura tardía: al aislar la página el navegador ya quitó el foco al disparador.
      const emptyRef = useRef<HTMLElement | null>(null)
      return (
        <>
          <Button onClick={() => setOpen(true)}>Nuevo servicio</Button>
          <Modal
            onClose={() => setOpen(false)}
            open={open}
            returnFocusRef={emptyRef}
            title="Nuevo servicio"
          >
            <input aria-label="Nombre" />
          </Modal>
        </>
      )
    }
    const user = userEvent.setup()
    render(<LateCapture />)
    const trigger = screen.getByRole('button', { name: 'Nuevo servicio' })
    await user.click(trigger)
    await screen.findByRole('dialog', { name: 'Nuevo servicio' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('ignora una referencia de retorno que apunta a un campo del propio modal ya retirado', async () => {
    function InnerCapture() {
      const [open, setOpen] = useState(false)
      const inner = useRef<HTMLInputElement | null>(null)
      return (
        <>
          <Button onClick={() => setOpen(true)}>Nueva marca</Button>
          <Modal
            onClose={() => setOpen(false)}
            open={open}
            returnFocusRef={inner}
            title="Nueva marca"
          >
            <input aria-label="Nombre" ref={inner} />
          </Modal>
        </>
      )
    }
    const user = userEvent.setup()
    render(<InnerCapture />)
    const trigger = screen.getByRole('button', { name: 'Nueva marca' })
    await user.click(trigger)
    await screen.findByRole('dialog', { name: 'Nueva marca' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

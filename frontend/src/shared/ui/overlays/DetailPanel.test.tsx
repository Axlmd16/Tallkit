import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DetailPanel } from './DetailPanel'

describe('DetailPanel (C39) - Fase 9.1', () => {
  it('renders non-modal persistent panel with 302px width and content', () => {
    render(
      <DetailPanel
        description="Detalle complementario de orden"
        label="Detalle de ficha"
        title="Ficha Técnica"
      >
        <p>Contenido del panel lateral</p>
      </DetailPanel>,
    )

    const panel = screen.getByRole('complementary', {
      name: 'Detalle de ficha',
    })
    expect(panel).toBeVisible()
    expect(panel.className).toContain('w-[302px]')
    expect(
      screen.getByRole('heading', { level: 3, name: 'Ficha Técnica' }),
    ).toBeVisible()
    expect(screen.getByText('Detalle complementario de orden')).toBeVisible()
    expect(screen.getByText('Contenido del panel lateral')).toBeVisible()
  })

  it('renders close button when onClose is provided', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(
      <DetailPanel
        label="Panel lateral"
        onClose={handleClose}
        title="Opciones de Vista"
      >
        <span>Contenido</span>
      </DetailPanel>,
    )

    const closeBtn = screen.getByRole('button', { name: 'Cerrar panel' })
    expect(closeBtn).toBeVisible()

    await user.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT block or trap focus, allowing free keyboard access to neighboring content', async () => {
    const user = userEvent.setup()

    render(
      <div className="flex">
        <main>
          <button type="button">Botón principal vecino</button>
          <input aria-label="Entrada vecina" type="text" />
        </main>
        <DetailPanel label="Panel de apoyo" title="Ayuda lateral">
          <button type="button">Acción en panel</button>
        </DetailPanel>
      </div>,
    )

    const mainBtn = screen.getByRole('button', {
      name: 'Botón principal vecino',
    })
    const mainInput = screen.getByRole('textbox', { name: 'Entrada vecina' })
    const panelBtn = screen.getByRole('button', { name: 'Acción en panel' })

    // El foco puede moverse libremente al botón vecino
    await user.click(mainBtn)
    expect(mainBtn).toHaveFocus()

    // Tab navega al input vecino
    await user.tab()
    expect(mainInput).toHaveFocus()

    // Tab navega al botón dentro de DetailPanel sin ser bloqueado por backdrop ni focus trap
    await user.tab()
    expect(panelBtn).toHaveFocus()

    // Shift+Tab navega de regreso libremente
    await user.tab({ shift: true })
    expect(mainInput).toHaveFocus()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'

import { NavigationPanel } from './NavigationPanel'

function Example() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button onClick={() => setOpen(true)} ref={trigger} type="button">
        Menú
      </button>
      <NavigationPanel
        description="Elija una función disponible."
        onClose={() => setOpen(false)}
        open={open}
        returnFocusRef={trigger}
        title="Navegación principal"
      >
        <a href="/sales">Ventas</a>
        <a href="/purchases">Ingresos</a>
      </NavigationPanel>
    </>
  )
}

describe('NavigationPanel', () => {
  it('abre un panel modal con nombre y descripción accesibles, a la izquierda', async () => {
    render(<Example />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Menú' }))
    const panel = screen.getByRole('dialog', { name: 'Navegación principal' })
    expect(panel).toHaveAttribute('aria-modal', 'true')
    expect(panel).toHaveAccessibleDescription('Elija una función disponible.')
    expect(panel.className).toMatch(/\bmr-auto\b/)
  })

  it('contiene el foco, se cierra con Escape y devuelve el foco al menú', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    const panel = screen.getByRole('dialog', { name: 'Navegación principal' })
    expect(panel.contains(document.activeElement)).toBe(true)
    for (let i = 0; i < 4; i += 1) await user.tab()
    expect(panel.contains(document.activeElement)).toBe(true)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Menú' })).toHaveFocus()
  })

  it('se cierra con su control y al pulsar fuera del panel, sin pedir confirmación', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar navegación' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Menú' }))
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.pointer({ keys: '[MouseLeft]', target: backdrop })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

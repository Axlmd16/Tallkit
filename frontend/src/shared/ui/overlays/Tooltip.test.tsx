import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Tooltip } from './Tooltip'

describe('Tooltip (C16)', () => {
  it('shows tooltip on hover and hides on unhover', async () => {
    const user = userEvent.setup()

    render(
      <Tooltip content="Información adicional">
        <button type="button">Pasa el cursor</button>
      </Tooltip>,
    )

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Pasa el cursor' })
    await user.hover(trigger)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('Información adicional')
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id)

    await user.unhover(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows tooltip on keyboard focus and hides on blur', async () => {
    const user = userEvent.setup()

    render(
      <Tooltip content="Ayuda por teclado">
        <button type="button">Enfócame</button>
      </Tooltip>,
    )

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Enfócame' })
    await user.tab()
    expect(trigger).toHaveFocus()

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('Ayuda por teclado')

    await user.tab()
    expect(trigger).not.toHaveFocus()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes tooltip when Escape key is pressed', async () => {
    const user = userEvent.setup()

    render(
      <Tooltip content="Texto de ayuda">
        <button type="button">Botón con Escape</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Botón con Escape' })
    await user.tab()
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('supports controlled open prop for static preview/catalog captures', () => {
    render(
      <Tooltip content="Visible en catálogo" open>
        <button type="button">Disparador fijo</button>
      </Tooltip>,
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('Visible en catálogo')
  })

  it('does not display when disabled is true', async () => {
    const user = userEvent.setup()

    render(
      <Tooltip content="No visible" disabled>
        <button type="button">Deshabilitado</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Deshabilitado' })
    await user.hover(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusBadge } from './states'

describe('StatusBadge Tallkit', () => {
  it('es una píldora con punto por defecto, con rol status y anuncio', () => {
    render(<StatusBadge label="En proceso" tone="info" />)
    const badge = screen.getByRole('status', { name: 'Estado: En proceso' })
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('rounded-full')
    expect(badge.querySelector('[data-marker]')).toBeInTheDocument()
  })

  it('admite la forma rectangular cuando se pide expresamente', () => {
    render(<StatusBadge label="Completado" shape="rectangle" tone="success" />)
    const badge = screen.getByRole('status', { name: 'Estado: Completado' })
    expect(badge.className).toContain('rounded-chip')
  })

  it('soporta variante de categoría sin anunciar como resultado de estado (F13 4:6246)', () => {
    render(
      <StatusBadge
        kind="category"
        label="Mantenimiento Mayor"
        tone="neutral"
      />,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const badge = screen.getByText('Mantenimiento Mayor')
    expect(badge).toHaveAttribute(
      'aria-label',
      'Categoría: Mantenimiento Mayor',
    )
  })
})

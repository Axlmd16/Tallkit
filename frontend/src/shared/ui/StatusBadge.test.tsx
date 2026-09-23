import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusBadge } from './states'

describe('StatusBadge Tallkit', () => {
  it('es rectangular por defecto, con rol status, anuncio y marcador', () => {
    render(<StatusBadge label="En proceso" tone="info" />)
    const badge = screen.getByRole('status', { name: 'Estado: En proceso' })
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('rounded-chip')
    expect(badge.querySelector('[data-marker]')).toBeInTheDocument()
  })

  it('admite la forma de píldora cuando se pide expresamente', () => {
    render(<StatusBadge label="Completado" shape="pill" tone="success" />)
    const badge = screen.getByRole('status', { name: 'Estado: Completado' })
    expect(badge.className).toContain('rounded-full')
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

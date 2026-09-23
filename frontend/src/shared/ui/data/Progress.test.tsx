import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Progress } from './Progress'

describe('Progress (C54) - Fase 11.3', () => {
  it('renders linear progress with role="progressbar" and accessible attributes', () => {
    render(<Progress value={65} max={100} label="Carga de datos" showValue />)

    const progressbar = screen.getByRole('progressbar', {
      name: /carga de datos/i,
    })
    expect(progressbar).toBeInTheDocument()
    expect(progressbar).toHaveAttribute('aria-valuenow', '65')
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '100')

    // Label and value text
    expect(screen.getByText('Carga de datos')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
  })

  it('distinguishes zero progress from indeterminate state', () => {
    const { rerender } = render(<Progress value={0} label="Completado" />)
    const zeroProgress = screen.getByRole('progressbar', {
      name: /completado/i,
    })
    expect(zeroProgress).toHaveAttribute('aria-valuenow', '0')
    expect(zeroProgress).not.toHaveAttribute('aria-busy')

    // Indeterminate
    rerender(<Progress indeterminate label="Procesando..." />)
    const indetProgress = screen.getByRole('progressbar', {
      name: /procesando\.\.\./i,
    })
    expect(indetProgress).not.toHaveAttribute('aria-valuenow')
    expect(indetProgress).toHaveAttribute('aria-busy', 'true')
  })

  it('renders circular progress variant with SVG geometry', () => {
    render(
      <Progress
        variant="circular"
        value={75}
        size="md"
        label="Progreso circular"
        showValue
      />,
    )

    const progressbar = screen.getByRole('progressbar', {
      name: /progreso circular/i,
    })
    expect(progressbar).toBeInTheDocument()
    expect(progressbar).toHaveAttribute('aria-valuenow', '75')

    const svg = progressbar.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('usa los tokens semánticos de Tallkit sin variantes de tema oscuro', () => {
    const { container } = render(
      <>
        <Progress label="Lineal" tone="success" value={40} />
        <Progress
          label="Circular"
          tone="primary"
          value={40}
          variant="circular"
        />
      </>,
    )
    expect(container.innerHTML).toMatch(/bg-success/)
    expect(container.innerHTML).toMatch(/var\(--color-primary\)/)
    expect(container.innerHTML).not.toMatch(
      /dark:|emerald|amber-|rose-|#[0-9a-f]{6}/i,
    )
  })
})

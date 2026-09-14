import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MetricCard } from './MetricCard'

describe('MetricCard (C22)', () => {
  it('renders standard dimensions with 116px min-height, 60px icon and 22px value', () => {
    render(
      <MetricCard
        detail="Últimos 30 días"
        icon={<span data-testid="metric-icon">🚗</span>}
        label="Vehículos en Taller"
        value="48"
      />,
    )

    const card = screen.getByRole('article')
    expect(card.className).toContain('min-h-[116px]')

    const iconWrapper = screen.getByTestId('metric-icon').parentElement
    expect(iconWrapper?.className).toContain('size-[60px]')

    const valueEl = screen.getByText('48')
    expect(valueEl.className).toContain('text-[22px]')
    expect(screen.getByText('Vehículos en Taller')).toBeInTheDocument()
    expect(screen.getByText('Últimos 30 días')).toBeInTheDocument()
  })

  it('supports the four accent variants: primary, success, warning, info', () => {
    const { rerender } = render(
      <MetricCard
        accent="primary"
        icon={<span>⭐</span>}
        label="Primario"
        value="1"
      />,
    )

    let iconWrapper = screen.getByText('⭐').parentElement
    expect(iconWrapper?.className).toContain('bg-primary-soft')
    expect(iconWrapper?.className).toContain('text-primary')

    rerender(
      <MetricCard
        accent="success"
        icon={<span>⭐</span>}
        label="Éxito"
        value="2"
      />,
    )
    iconWrapper = screen.getByText('⭐').parentElement
    expect(iconWrapper?.className).toContain('bg-success-soft')
    expect(iconWrapper?.className).toContain('text-success')

    rerender(
      <MetricCard
        accent="warning"
        icon={<span>⭐</span>}
        label="Alerta"
        value="3"
      />,
    )
    iconWrapper = screen.getByText('⭐').parentElement
    expect(iconWrapper?.className).toContain('bg-warning-soft')
    expect(iconWrapper?.className).toContain('text-warning')

    rerender(
      <MetricCard
        accent="info"
        icon={<span>⭐</span>}
        label="Información"
        value="4"
      />,
    )
    iconWrapper = screen.getByText('⭐').parentElement
    expect(iconWrapper?.className).toContain('bg-surface-selected')
  })

  it('supports compact size variant equivalent to StatCard', () => {
    render(
      <MetricCard
        icon={<span>📦</span>}
        label="Compacta"
        size="compact"
        value="12"
      />,
    )

    const card = screen.getByRole('article')
    expect(card.className).toContain('min-h-24')

    const iconWrapper = screen.getByText('📦').parentElement
    expect(iconWrapper?.className).toContain('size-12')
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LineAreaChart } from './index'

describe('LineAreaChart (C50) - Fase 11.2', () => {
  const sampleData = [
    { label: 'Ene', value: 10 },
    { label: 'Feb', value: 25 },
    { label: 'Mar', value: 15 },
    { label: 'Abr', value: 30 },
  ]

  it('renders SVG chart with grid, line path, area fill and points', () => {
    const { container } = render(
      <LineAreaChart
        ariaLabel="Gráfico de órdenes mensuales"
        data={sampleData}
        showArea
      />,
    )

    const svg = screen.getByRole('group', {
      name: 'Gráfico de órdenes mensuales',
    })
    expect(svg).toBeVisible()

    // Rejilla de fondo
    const gridLines = container.querySelectorAll('.chart-grid-line')
    expect(gridLines.length).toBeGreaterThan(0)

    // Línea y área
    const linePath = container.querySelector('.chart-line-path')
    const areaPath = container.querySelector('.chart-area-path')
    expect(linePath).toBeInTheDocument()
    expect(areaPath).toBeInTheDocument()

    // Puntos interactivos
    const points = screen.getAllByRole('button', { name: /Ene|Feb|Mar|Abr/ })
    expect(points.length).toBe(4)
  })

  it('handles single data point gracefully without NaN coordinates', () => {
    const singlePoint = [{ label: 'Único', value: 50 }]
    const { container } = render(
      <LineAreaChart ariaLabel="Gráfico con punto único" data={singlePoint} />,
    )

    const linePath = container.querySelector('.chart-line-path')
    expect(linePath).toBeInTheDocument()
    const d = linePath?.getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')

    const pointBtn = screen.getByRole('button', { name: /Único: 50/ })
    expect(pointBtn).toBeVisible()
  })

  it('handles zero values and missing (null) values deterministically', () => {
    const dataWithGaps = [
      { label: 'P1', value: 0 },
      { label: 'P2', value: null },
      { label: 'P3', value: 20 },
    ]

    const { container } = render(
      <LineAreaChart
        ariaLabel="Gráfico con huecos y ceros"
        data={dataWithGaps}
      />,
    )

    // Puntos solo para valores no nulos (P1 y P3)
    const points = screen.getAllByRole('button')
    expect(points.length).toBe(2)

    const p1 = screen.getByRole('button', { name: /P1: 0/ })
    const p3 = screen.getByRole('button', { name: /P3: 20/ })
    expect(p1).toBeVisible()
    expect(p3).toBeVisible()

    // Coordenadas válidas sin NaN
    const paths = container.querySelectorAll('path')
    paths.forEach((p) => {
      const d = p.getAttribute('d') ?? ''
      expect(d).not.toContain('NaN')
    })
  })

  it('shows tooltip or announces value when hovering or focusing a data point', async () => {
    const user = userEvent.setup()
    render(<LineAreaChart ariaLabel="Gráfico interactivo" data={sampleData} />)

    const febPoint = screen.getByRole('button', { name: /Feb: 25/ })
    await user.hover(febPoint)

    expect(screen.getByText('Feb: 25')).toBeVisible()
  })
})

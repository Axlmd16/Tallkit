import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DonutChart } from './DonutChart'
import { Progress } from '../data/Progress'

describe('DonutChart (C51) - Fase 11.3', () => {
  const sampleData = [
    { id: 'cat1', label: 'Reparaciones', value: 45, color: '#605bff' },
    { id: 'cat2', label: 'Mantenimientos', value: 30, color: '#10b981' },
    { id: 'cat3', label: 'Diagnósticos', value: 25, color: '#f59e0b' },
  ]

  it('renders SVG donut with segments and calculates center total', () => {
    render(
      <DonutChart
        data={sampleData}
        centerLabel="Servicios"
        ariaLabel="Distribución de servicios"
      />,
    )

    const chart = screen.getByRole('group', {
      name: /distribución de servicios/i,
    })
    expect(chart).toBeInTheDocument()

    // Center total should be sum of values (45 + 30 + 25 = 100)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('Servicios')).toBeInTheDocument()

    // SVG should have path/circle elements for the 3 segments
    const segments = chart.querySelectorAll('[data-donut-segment]')
    expect(segments.length).toBe(3)
  })

  it('handles zero total distinctly from empty data', () => {
    // Caso 1: Cero total (elementos con valor 0)
    const zeroData = [
      { id: 'z1', label: 'Tipo A', value: 0 },
      { id: 'z2', label: 'Tipo B', value: 0 },
    ]
    const { rerender } = render(
      <DonutChart data={zeroData} centerLabel="Registros" />,
    )

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Registros')).toBeInTheDocument()
    expect(screen.queryByText('Sin datos')).not.toBeInTheDocument()

    // Caso 2: Datos completamente vacíos
    rerender(
      <DonutChart data={[]} emptyMessage="No hay registros disponibles" />,
    )
    expect(
      screen.getAllByText('No hay registros disponibles').length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('provides accessible text alternative without relying solely on color', () => {
    render(<DonutChart data={sampleData} ariaLabel="Resumen de órdenes" />)

    // Accessible text alternative with percentages and labels
    const textAlternative = screen.getByTestId('donut-text-alternative')
    expect(textAlternative).toBeInTheDocument()
    expect(textAlternative).toHaveTextContent(/Reparaciones: 45 \(45(\.0)?%\)/)
    expect(textAlternative).toHaveTextContent(
      /Mantenimientos: 30 \(30(\.0)?%\)/,
    )
    expect(textAlternative).toHaveTextContent(/Diagnósticos: 25 \(25(\.0)?%\)/)
  })

  it('allows segment keyboard focus and click callback', async () => {
    const user = userEvent.setup()
    const handleSegmentClick = vi.fn()

    render(<DonutChart data={sampleData} onSegmentClick={handleSegmentClick} />)

    const firstSegment = screen.getByRole('button', { name: /reparaciones/i })
    expect(firstSegment).toBeInTheDocument()

    await user.click(firstSegment)
    expect(handleSegmentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Reparaciones',
        value: 45,
      }),
    )
  })
})

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
})

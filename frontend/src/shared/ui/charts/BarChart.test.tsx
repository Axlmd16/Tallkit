import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BarChart } from './BarChart'

describe('BarChart (C52) - Fase 11.4', () => {
  const sampleData = [
    { id: 'b1', label: 'Enero', value: 40, color: '#605bff' },
    { id: 'b2', label: 'Febrero', value: 75, color: '#10b981' },
    { id: 'b3', label: 'Marzo', value: 20, color: '#f59e0b' },
  ]

  it('renders vertical bar chart with SVG geometry and category labels', () => {
    render(
      <BarChart
        data={sampleData}
        orientation="vertical"
        ariaLabel="Ventas del primer trimestre"
      />,
    )

    const chart = screen.getByRole('group', {
      name: /ventas del primer trimestre/i,
    })
    expect(chart).toBeInTheDocument()

    // Categorías en eje X
    expect(screen.getByText('Enero')).toBeInTheDocument()
    expect(screen.getByText('Febrero')).toBeInTheDocument()
    expect(screen.getByText('Marzo')).toBeInTheDocument()

    // Barras interactivas
    const bars = chart.querySelectorAll('[data-bar-item]')
    expect(bars.length).toBe(3)
  })

  it('renders horizontal bar chart with labels and widths', () => {
    render(
      <BarChart
        data={sampleData}
        orientation="horizontal"
        ariaLabel="Rendimiento por mes"
      />,
    )

    const chart = screen.getByRole('group', { name: /rendimiento por mes/i })
    expect(chart).toBeInTheDocument()

    // Barras horizontales
    const bars = chart.querySelectorAll('[data-bar-item]')
    expect(bars.length).toBe(3)

    // Valores o etiquetas visibles
    expect(screen.getByText('Enero')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('handles zero values and empty datasets safely without NaN coordinates', () => {
    const dataWithZeros = [
      { label: 'Inactivo', value: 0 },
      { label: 'Activo', value: 50 },
    ]

    const { rerender } = render(
      <BarChart data={dataWithZeros} orientation="vertical" />,
    )

    const bars = document.querySelectorAll('[data-bar-item]')
    expect(bars.length).toBe(2)
    // No NaN en atributos
    bars.forEach((bar) => {
      expect(bar.getAttribute('height')).not.toContain('NaN')
      expect(bar.getAttribute('y')).not.toContain('NaN')
    })

    // Caso de dataset vacío
    rerender(<BarChart data={[]} emptyMessage="No hay métricas disponibles" />)
    expect(screen.getByText('No hay métricas disponibles')).toBeInTheDocument()
  })

  it('provides accessible text alternative and keyboard activation', async () => {
    const user = userEvent.setup()
    const handleBarClick = vi.fn()

    render(
      <BarChart
        data={sampleData}
        onBarClick={handleBarClick}
        ariaLabel="Resumen trimestral"
      />,
    )

    // Alternativa textual accesible
    const textAlternative = screen.getByTestId('barchart-text-alternative')
    expect(textAlternative).toBeInTheDocument()
    expect(textAlternative).toHaveTextContent(/Enero: 40/)
    expect(textAlternative).toHaveTextContent(/Febrero: 75/)

    // Activación por teclado
    const febBar = screen.getByRole('button', { name: /febrero: 75/i })
    expect(febBar).toBeInTheDocument()

    febBar.focus()
    await user.keyboard('{Enter}')
    expect(handleBarClick).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Febrero',
        value: 75,
      }),
    )
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ChartContainer, ChartLegend } from './index'

describe('ChartContainer (C49) y ChartLegend (C53) - Fase 11.1', () => {
  it('renders ChartContainer with title, actions, and chart children', () => {
    render(
      <ChartContainer
        actions={<button type="button">Filtrar</button>}
        subtitle="Últimos 6 meses"
        title="Rendimiento de bahías"
      >
        <div data-testid="svg-chart">Gráfico SVG simulado</div>
      </ChartContainer>,
    )

    expect(
      screen.getByRole('heading', { name: 'Rendimiento de bahías' }),
    ).toBeVisible()
    expect(screen.getByText('Últimos 6 meses')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeVisible()
    expect(screen.getByTestId('svg-chart')).toBeVisible()
  })

  it('renders tabular alternative and toggles between graphical and tabular views', async () => {
    const user = userEvent.setup()

    render(
      <ChartContainer
        tableAlternative={
          <table data-testid="accessible-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Órdenes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Enero</td>
                <td>45</td>
              </tr>
            </tbody>
          </table>
        }
        title="Métricas mensuales"
      >
        <div data-testid="graphic-view">Vista Gráfica</div>
      </ChartContainer>,
    )

    // Inicialmente se muestra la vista gráfica
    expect(screen.getByTestId('graphic-view')).toBeVisible()
    expect(screen.queryByTestId('accessible-table')).not.toBeInTheDocument()

    // El botón para alternar a vista tabular existe y es accesible
    const toggleBtn = screen.getByRole('button', {
      name: /ver tabla de datos/i,
    })
    expect(toggleBtn).toBeVisible()
    await user.click(toggleBtn)

    // Al alternar, se muestra la tabla accesible y se oculta la gráfica
    expect(screen.getByTestId('accessible-table')).toBeVisible()
    expect(screen.queryByTestId('graphic-view')).not.toBeInTheDocument()

    // Volver a vista gráfica
    const toggleBackBtn = screen.getByRole('button', { name: /ver gráfico/i })
    await user.click(toggleBackBtn)
    expect(screen.getByTestId('graphic-view')).toBeVisible()
    expect(screen.queryByTestId('accessible-table')).not.toBeInTheDocument()
  })

  it('renders empty state when empty prop is true', () => {
    render(
      <ChartContainer
        empty
        emptyMessage="No se encontraron registros para el período seleccionado."
        title="Órdenes finalizadas"
      >
        <div data-testid="graphic-view">Gráfico</div>
      </ChartContainer>,
    )

    expect(screen.queryByTestId('graphic-view')).not.toBeInTheDocument()
    expect(screen.getByText(/No se encontraron registros/i)).toBeVisible()
  })

  it('renders ChartLegend with items, colors, and values in horizontal/vertical modes', () => {
    const items = [
      { id: '1', label: 'Preventivo', color: '#6366f1', value: 34 },
      { id: '2', label: 'Correctivo', color: '#f59e0b', value: 18 },
    ]

    const { rerender } = render(
      <ChartLegend items={items} orientation="horizontal" />,
    )

    expect(screen.getByText('Preventivo')).toBeVisible()
    expect(screen.getByText('34')).toBeVisible()
    expect(screen.getByText('Correctivo')).toBeVisible()
    expect(screen.getByText('18')).toBeVisible()

    const list = screen.getByRole('list', { name: 'Leyenda del gráfico' })
    expect(list.className).toContain('flex-wrap')

    rerender(<ChartLegend items={items} orientation="vertical" />)
    expect(list.className).toContain('flex-col')
  })
})

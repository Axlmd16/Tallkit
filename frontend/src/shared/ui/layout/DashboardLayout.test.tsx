import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DashboardLayout } from './DashboardLayout'

describe('DashboardLayout (C30)', () => {
  it('renders metrics region and panel grid without page classes', () => {
    render(
      <DashboardLayout
        metrics={
          <div data-testid="metrics-grid">
            <span>Métrica 1</span>
            <span>Métrica 2</span>
            <span>Métrica 3</span>
            <span>Métrica 4</span>
          </div>
        }
      >
        <div data-testid="panel-a">Gráfico de ingresos</div>
        <div data-testid="panel-b">Órdenes recientes</div>
      </DashboardLayout>,
    )

    const region = screen.getByRole('region', { name: 'Métricas clave' })
    expect(region).toBeInTheDocument()
    expect(screen.getByTestId('metrics-grid')).toBeInTheDocument()
    expect(screen.getByTestId('panel-a')).toBeInTheDocument()
    expect(screen.getByTestId('panel-b')).toBeInTheDocument()
  })

  it('renders with optional side panel in multi-column layout', () => {
    render(
      <DashboardLayout
        sidePanel={
          <aside data-testid="activity-sidebar">Actividad reciente</aside>
        }
      >
        <div>Contenido central</div>
      </DashboardLayout>,
    )

    expect(screen.getByTestId('activity-sidebar')).toBeInTheDocument()
    expect(screen.getByText('Contenido central')).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { StatLink, StatGrid } from './StatLink'

function renderInRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

describe('StatLink — indicador con conteo', () => {
  it('es un enlace cuyo nombre reúne valor, etiqueta y ámbito fiscal', () => {
    renderInRouter(
      <StatLink
        label="Ventas de contado sin cobrar"
        scope="commercial"
        to="/sales/receivables?condition=CONTADO&only_debt=true"
        value={3}
      />,
    )
    const link = screen.getByRole('link', {
      name: '3 Ventas de contado sin cobrar, RUC comercial',
    })
    expect(link).toHaveAttribute(
      'href',
      '/sales/receivables?condition=CONTADO&only_debt=true',
    )
    expect(screen.getByText('Comercial')).toBeInTheDocument()
  })

  it('sin ámbito fiscal no lo menciona', () => {
    renderInRouter(
      <StatLink label="Mantenimientos abiertos" to="/maintenance" value={4} />,
    )
    expect(
      screen.getByRole('link', { name: '4 Mantenimientos abiertos' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Comercial')).not.toBeInTheDocument()
    expect(screen.queryByText('Artesanal')).not.toBeInTheDocument()
  })

  it('el cero se muestra atenuado y sin énfasis de advertencia', () => {
    renderInRouter(
      <StatLink label="Borradores de venta" to="/sales" value={0} />,
    )
    const value = screen.getByText('0')
    expect(value).toHaveAttribute('data-zero', 'true')
    expect(value.className).toContain('text-ink-muted')
    expect(value.className).not.toMatch(/warning|danger/)
  })

  it('muestra un importe con la pieza de dinero y un detalle', () => {
    renderInRouter(
      <StatLink
        amount="1300.50"
        detail="2 clientes"
        label="Por cobrar"
        scope="artesanal"
        to="/maintenance/receivables"
      />,
    )
    expect(
      screen.getByRole('link', {
        name: 'USD 1,300.50 Por cobrar, RUC artesanal, 2 clientes',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('USD 1,300.50')).toBeInTheDocument()
    expect(screen.getByText('2 clientes')).toBeInTheDocument()
  })

  it('ofrece un objetivo táctil suficiente y foco visible del sistema', () => {
    renderInRouter(<StatLink label="Pendientes" to="/x" value={1} />)
    const link = screen.getByRole('link')
    expect(link.className).toContain('min-h-11')
    expect(link.className).toContain('focus-visible:')
    expect(link.className).not.toMatch(/shadow/)
  })

  it('varios indicadores comparten un panel, sin tarjeta elevada por cada uno', () => {
    renderInRouter(
      <StatGrid label="Pendientes">
        <StatLink label="Uno" to="/a" value={1} />
        <StatLink label="Dos" to="/b" value={2} />
        <StatLink label="Tres" to="/c" value={3} />
        <StatLink label="Cuatro" to="/d" value={4} />
      </StatGrid>,
    )
    const list = screen.getByRole('list', { name: 'Pendientes' })
    expect(list.className).not.toMatch(/shadow/)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).not.toMatch(/shadow|rounded-panel/)
    }
  })
})

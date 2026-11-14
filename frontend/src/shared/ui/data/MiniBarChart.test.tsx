import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MiniBarChart } from './MiniBarChart'

const DAYS = [
  { date: '2026-09-30', amount: '10.00' },
  { date: '2026-10-01', amount: '40.00' },
  { date: '2026-10-02', amount: '20.00' },
  { date: '2026-10-03', amount: '0.00' },
  { date: '2026-10-04', amount: '80.00' },
  { date: '2026-10-05', amount: '5.50' },
  { date: '2026-10-06', amount: '1200.00' },
]

describe('MiniBarChart — gráfico breve', () => {
  it('identifica su ámbito con nombre e icono y usa su tono', () => {
    render(
      <MiniBarChart
        days={DAYS}
        scope="artesanal"
        title="Cobrado en 7 días"
        total="1355.50"
      />,
    )
    const figure = screen.getByRole('group', {
      name: 'Cobrado en 7 días, Servicios',
    })
    expect(within(figure).getByText('Artesanal')).toBeInTheDocument()
    expect(within(figure).getByText('USD 1,355.50')).toBeInTheDocument()
    const bars = figure.querySelectorAll('[data-bar]')
    expect(bars).toHaveLength(7)
    const withValue = [...bars].filter(
      (bar) => !(bar as HTMLElement).dataset.zero,
    )
    expect(withValue).toHaveLength(6)
    for (const bar of withValue) {
      expect(bar.className).toContain('bg-scope-artisan')
    }
    for (const bar of bars) {
      expect(bar.className).not.toContain('bg-scope-commercial')
    }
  })

  it('el ámbito comercial usa su propio tono', () => {
    render(
      <MiniBarChart
        days={DAYS}
        scope="commercial"
        title="Cobrado en 7 días"
        total="1355.50"
      />,
    )
    expect(screen.getByText('Comercial')).toBeInTheDocument()
    const bar = document.querySelector('[data-bar]')
    expect(bar?.className).toContain('bg-scope-commercial')
  })

  it('cada barra expone su fecha y su importe como texto', () => {
    render(
      <MiniBarChart
        days={DAYS}
        scope="commercial"
        title="Cobrado en 7 días"
        total="1355.50"
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(7)
    expect(
      screen.getByRole('img', { name: 'martes 6 de octubre: USD 1,200.00' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'sábado 3 de octubre: USD 0.00' }),
    ).toBeInTheDocument()
  })

  it('muestra el valor al enfocar una barra con el teclado', async () => {
    const user = userEvent.setup()
    render(
      <MiniBarChart
        days={DAYS}
        scope="commercial"
        title="Cobrado en 7 días"
        total="1355.50"
      />,
    )
    await user.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'miércoles 30 de septiembre',
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent('USD 10.00')
  })

  it('la altura es proporcional al máximo y el cero conserva una línea de base', () => {
    render(
      <MiniBarChart
        days={DAYS}
        scope="commercial"
        title="Cobrado en 7 días"
        total="1355.50"
      />,
    )
    const bars = [...document.querySelectorAll<HTMLElement>('[data-bar]')]
    expect(bars[6]?.style.height).toBe('100%')
    expect(bars[3]?.dataset.zero).toBe('true')
    expect(bars[3]?.style.height).toBe('')
    expect(bars[0]?.dataset.zero).toBeUndefined()
  })

  it('distingue una semana en cero de la ausencia de datos', () => {
    const zero = DAYS.map((day) => ({ ...day, amount: '0.00' }))
    const { rerender } = render(
      <MiniBarChart
        days={zero}
        scope="commercial"
        title="Cobrado en 7 días"
        total="0.00"
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByText('USD 0.00')).toBeInTheDocument()
    expect(screen.queryByText('Sin datos')).not.toBeInTheDocument()

    rerender(
      <MiniBarChart
        days={[]}
        scope="commercial"
        title="Cobrado en 7 días"
        total={null}
      />,
    )
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.queryByText('USD 0.00')).not.toBeInTheDocument()
  })

  it('no anima cuando el dispositivo pide movimiento reducido', () => {
    render(
      <MiniBarChart
        days={DAYS}
        scope="commercial"
        title="Cobrado en 7 días"
        total="1355.50"
      />,
    )
    for (const bar of document.querySelectorAll('[data-bar]')) {
      expect(bar.className).toContain('motion-reduce:transition-none')
      expect(bar.className).not.toMatch(/animate-/)
    }
  })
})

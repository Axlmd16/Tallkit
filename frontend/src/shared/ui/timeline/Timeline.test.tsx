import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Timeline } from './Timeline'

const rows = [
  {
    id: 'a',
    label: 'Elemento A',
    start: -10,
    end: 25,
    tone: 'primary' as const,
  },
  {
    id: 'b',
    label: 'Elemento B',
    start: 75,
    end: 120,
    tone: 'warning' as const,
  },
]

describe('Timeline (C60)', () => {
  it('clamps bars to the supplied visual range', () => {
    render(
      <Timeline
        ariaLabel="Cronograma sintético"
        end={100}
        rows={rows}
        start={0}
        ticks={[
          { value: 0, label: 'Inicio' },
          { value: 50, label: 'Centro' },
          { value: 100, label: 'Fin' },
        ]}
      />,
    )

    expect(screen.getByRole('button', { name: /Elemento A/i })).toHaveStyle({
      left: '0%',
      width: '25%',
    })
    expect(screen.getByRole('button', { name: /Elemento B/i })).toHaveStyle({
      left: '75%',
      width: '25%',
    })
  })

  it('provides a textual reading alternative independent of color', () => {
    render(<Timeline end={100} rows={rows} start={0} />)

    const alternative = screen.getByTestId('timeline-text-alternative')
    expect(alternative).toHaveTextContent('Elemento A: -10 a 25')
    expect(alternative).toHaveTextContent('Elemento B: 75 a 120')
  })

  it('reports row selection from pointer and keyboard activation', async () => {
    const user = userEvent.setup()
    const onSelectRow = vi.fn()
    render(
      <Timeline end={100} onSelectRow={onSelectRow} rows={rows} start={0} />,
    )

    const row = screen.getByRole('button', { name: /Elemento B/i })
    await user.click(row)
    expect(onSelectRow).toHaveBeenLastCalledWith(rows[1])

    row.focus()
    await user.keyboard('{Enter}')
    expect(onSelectRow).toHaveBeenCalledTimes(2)
  })
})

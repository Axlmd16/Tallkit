import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Board } from './Board'
import { BoardCard } from './BoardCard'

const columns = [
  {
    id: 'one',
    title: 'Grupo A',
    cards: [
      {
        id: 'a',
        title: 'Elemento A',
        description:
          'Texto sintético deliberadamente extenso para comprobar ajuste sin recortar el contenido esencial.',
        avatars: [{ label: 'Inicial A', name: 'Elemento A' }],
        media: true,
      },
    ],
  },
  {
    id: 'two',
    title: 'Grupo B',
    cards: [
      { id: 'b', title: 'Elemento B' },
      { id: 'c', title: 'Elemento C' },
    ],
  },
]

describe('Board y BoardCard (C61–C62)', () => {
  it('renders supplied columns, exact counters and composed media primitives', () => {
    render(<Board columns={columns} label="Tablero sintético" />)

    expect(screen.getByRole('heading', { name: 'Grupo A' })).toBeVisible()
    expect(screen.getByLabelText('Grupo A: 1 elementos')).toBeVisible()
    expect(screen.getByLabelText('Grupo B: 2 elementos')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Inicial A' })).toBeVisible()
    expect(screen.getByLabelText('Medio neutral de Elemento A')).toBeVisible()
  })

  it('preserves long text and exposes controlled selection by keyboard', async () => {
    const user = userEvent.setup()
    const onSelectCard = vi.fn()
    render(
      <Board
        columns={columns}
        label="Tablero sintético"
        onSelectCard={onSelectCard}
        selectedCardId="b"
      />,
    )

    expect(screen.getByText(/deliberadamente extenso/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /Elemento B/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const card = screen.getByRole('button', { name: /Elemento C/i })
    card.focus()
    await user.keyboard(' ')
    expect(onSelectCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c', title: 'Elemento C' }),
    )
  })

  it('does not expose drag-and-drop semantics', () => {
    const { container } = render(
      <Board columns={columns} label="Tablero sintético" />,
    )

    expect(container.querySelector('[draggable="true"]')).toBeNull()
    expect(container.querySelector('[aria-grabbed]')).toBeNull()
  })

  it('keeps a nested card action independent from card selection', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onSelect = vi.fn()
    render(
      <BoardCard
        actions={<button onClick={onAction}>Acción local</button>}
        id="a"
        onSelect={onSelect}
        title="Elemento A"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Acción local' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

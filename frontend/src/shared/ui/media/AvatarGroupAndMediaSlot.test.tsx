import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AvatarGroup } from './AvatarGroup'
import { MediaSlot } from './MediaSlot'

describe('AvatarGroup y MediaSlot (C25, C66)', () => {
  it('renders overlapping avatars up to max count and displays overflow counter', () => {
    const members = [
      { name: 'Ana Gómez' },
      { name: 'Carlos Díaz' },
      { name: 'Elena Ruiz' },
      { name: 'Mario López' },
      { name: 'Sofía Castro' },
    ]

    render(<AvatarGroup aria-label="Equipo técnico" items={members} max={3} />)

    const group = screen.getByRole('group', { name: 'Equipo técnico' })
    expect(group).toBeInTheDocument()

    // Renderiza 3 avatares + 1 contador (+2)
    expect(screen.getByText('AG')).toBeInTheDocument()
    expect(screen.getByText('CD')).toBeInTheDocument()
    expect(screen.getByText('ER')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.queryByText('ML')).not.toBeInTheDocument()
  })

  it('renders MediaSlot neutral placeholder without external demo assets', () => {
    render(<MediaSlot aspectRatio="16:9" label="Diagrama del motor" />)

    const slot = screen.getByLabelText('Diagrama del motor')
    expect(slot).toBeInTheDocument()
    expect(slot.className).toContain('aspect-video')
    expect(screen.getByText('Diagrama del motor')).toBeInTheDocument()
  })
})

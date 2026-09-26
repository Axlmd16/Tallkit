import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FactList, FactRow } from './FactList'

describe('FactList', () => {
  it('presenta hechos con semántica de definición y separadores', () => {
    render(
      <FactList>
        <FactRow label="Razón social">DICISOL</FactRow>
      </FactList>,
    )

    expect(screen.getByRole('definition')).toBeInTheDocument()
    expect(screen.getByText('Razón social').tagName).toBe('DT')
    expect(screen.getByText('DICISOL').tagName).toBe('DD')
    expect(screen.getByText('Razón social').parentElement).toHaveClass(
      'border-line',
      'sm:grid-cols-[11.25rem_minmax(0,1fr)]',
    )
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Divider } from './Divider'

describe('C26: Divider', () => {
  it('renderiza separador horizontal por defecto', () => {
    render(<Divider />)
    const separator = screen.getByRole('separator')
    expect(separator).toBeInTheDocument()
    expect(separator.tagName).toBe('HR')
  })

  it('renderiza divisor con texto intercalado accesible (F17 4:9255)', () => {
    render(<Divider label="o continuar con" />)
    const separator = screen.getByRole('separator')
    expect(separator).toHaveTextContent('o continuar con')
    expect(separator).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('renderiza divisor vertical accesible', () => {
    render(<Divider orientation="vertical" />)
    const separator = screen.getByRole('separator')
    expect(separator).toHaveAttribute('aria-orientation', 'vertical')
    expect(separator.className).toContain('w-px')
  })
})

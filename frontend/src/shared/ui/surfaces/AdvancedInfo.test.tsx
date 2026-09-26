import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AdvancedInfo } from './AdvancedInfo'

describe('AdvancedInfo', () => {
  it('mantiene la información técnica plegada y disponible', () => {
    render(<AdvancedInfo>Catálogo SRI 2.34</AdvancedInfo>)

    const details = screen.getByText('Información avanzada').closest('details')
    expect(details).not.toHaveAttribute('open')
    expect(screen.getByText('Catálogo SRI 2.34')).toBeInTheDocument()
  })
})

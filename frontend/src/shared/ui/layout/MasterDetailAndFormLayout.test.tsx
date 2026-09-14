import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FormLayout } from './FormLayout'
import { MasterDetailLayout } from './MasterDetailLayout'

describe('MasterDetailLayout (C31) y FormLayout (C32)', () => {
  it('renders master and detail slots in correct DOM reading order', () => {
    render(
      <MasterDetailLayout
        detail={<aside data-testid="detail-slot">Panel de detalle</aside>}
        master={<section data-testid="master-slot">Tabla maestra</section>}
      />,
    )

    const master = screen.getByTestId('master-slot')
    const detail = screen.getByTestId('detail-slot')

    expect(master).toBeInTheDocument()
    expect(detail).toBeInTheDocument()
    // Verificar orden en el DOM
    expect(master.compareDocumentPosition(detail)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('renders FormLayout with 1 and 2 columns and actions', () => {
    const { rerender } = render(
      <FormLayout actions={<button type="button">Guardar</button>} columns={1}>
        <div>Campo 1</div>
      </FormLayout>,
    )

    expect(screen.getByText('Campo 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()

    rerender(
      <FormLayout actions={<button type="button">Guardar</button>} columns={2}>
        <div>Campo 1</div>
        <div>Campo 2</div>
      </FormLayout>,
    )

    expect(screen.getByText('Campo 2')).toBeInTheDocument()
  })

  it('renders FormLayout with optional lateral aside slot', () => {
    render(
      <FormLayout
        aside={<div data-testid="form-aside">Ayuda del formulario</div>}
      >
        <div>Campos principales</div>
      </FormLayout>,
    )

    expect(screen.getByTestId('form-aside')).toBeInTheDocument()
    expect(screen.getByText('Campos principales')).toBeInTheDocument()
  })
})

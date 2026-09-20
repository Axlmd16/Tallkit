import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FormSection, LeadingIcon } from './FormSection'

describe('FormSection', () => {
  it('names its group by title and shows the description', () => {
    render(
      <FormSection
        description="Datos para reconocer el producto."
        icon={<svg data-testid="section-icon" />}
        title="Identificación"
      >
        <input aria-label="Nombre" />
      </FormSection>,
    )

    const group = screen.getByRole('group', { name: 'Identificación' })
    expect(group).toContainElement(screen.getByLabelText('Nombre'))
    expect(
      screen.getByText('Datos para reconocer el producto.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('section-icon').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('lays fields out in two columns from small widths', () => {
    render(
      <FormSection title="Presentación">
        <input aria-label="Contenido" />
      </FormSection>,
    )

    expect(screen.getByLabelText('Contenido').parentElement).toHaveClass(
      'sm:grid-cols-2',
    )
  })
})

describe('LeadingIcon', () => {
  it('decorates a control without exposing the icon', () => {
    render(
      <LeadingIcon icon={<svg data-testid="lead" />}>
        <input aria-label="Precio" />
      </LeadingIcon>,
    )

    expect(screen.getByTestId('lead').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByLabelText('Precio')).toBeInTheDocument()
  })
})

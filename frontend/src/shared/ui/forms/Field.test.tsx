import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Field, FieldError, Input } from './index'

describe('C05/C09: Field y FieldError en shared/ui/forms', () => {
  it('asocia correctamente la etiqueta al control mediante id y htmlFor', () => {
    render(
      <Field id="neutral-name" label="Nombre neutral">
        <Input />
      </Field>,
    )

    const label = screen.getByText('Nombre neutral')
    const input = screen.getByRole('textbox')

    expect(label).toHaveAttribute('for', 'neutral-name')
    expect(input).toHaveAttribute('id', 'neutral-name')
  })

  it('asocia texto de ayuda (hint) mediante aria-describedby', () => {
    render(
      <Field hint="Texto de ayuda secundario" id="neutral-code" label="Código">
        <Input />
      </Field>,
    )

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-describedby', 'neutral-code-hint')
    expect(screen.getByText('Texto de ayuda secundario')).toHaveAttribute(
      'id',
      'neutral-code-hint',
    )
  })

  it('asocia mensaje de error mediante aria-describedby y activa aria-invalid="true"', () => {
    render(
      <Field
        error="El valor es requerido"
        id="neutral-required"
        label="Campo obligatorio"
      >
        <Input />
      </Field>,
    )

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'neutral-required-error')
    expect(screen.getByText('El valor es requerido')).toHaveAttribute(
      'id',
      'neutral-required-error',
    )
  })

  it('FieldError renderiza anuncio accesible con role="alert"', () => {
    render(<FieldError>Error crítico de validación</FieldError>)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('Error crítico de validación')
  })

  it('conserva el valor del campo tras cambios de estado y rerenders', () => {
    function TestForm() {
      const [val, setVal] = useState('Valor inicial')
      return (
        <Field id="test-preserve" label="Conservar valor">
          <Input value={val} onChange={(e) => setVal(e.target.value)} />
        </Field>
      )
    }

    render(<TestForm />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('Valor inicial')

    fireEvent.change(input, { target: { value: 'Nuevo valor editado' } })
    expect(input.value).toBe('Nuevo valor editado')
  })
})

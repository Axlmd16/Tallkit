import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Field } from './index'
import { Textarea } from './Textarea'

describe('C10: Textarea', () => {
  it('renderiza como textarea con rol textbox y altura multilínea', () => {
    render(<Textarea placeholder="Escriba aquí..." />)
    const textarea = screen.getByRole('textbox')
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toHaveAttribute('placeholder', 'Escriba aquí...')
    expect(textarea.className).toContain('rounded-group')
    expect(textarea.className).toContain('min-h-[')
  })

  it('se asocia automáticamente al contrato de Field (id, aria-describedby, aria-invalid)', () => {
    render(
      <Field
        error="La descripción es obligatoria"
        hint="Máximo 500 caracteres"
        id="descripcion"
        label="Descripción del producto"
      >
        <Textarea />
      </Field>,
    )

    const textarea = screen.getByRole('textbox', {
      name: 'Descripción del producto',
    })
    expect(textarea).toHaveAttribute('id', 'descripcion')
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea).toHaveAccessibleDescription(
      'Máximo 500 caracteres La descripción es obligatoria',
    )
  })

  it('soporta variante de radio r5 opt-in', () => {
    render(<Textarea placeholder="Radio r5" radius="r5" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea.className).toContain('rounded-control')
  })

  it('reenvía ref correctamente a la instancia HTMLTextAreaElement', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Textarea placeholder="Con ref" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('soporta estado disabled y resize vertical', () => {
    render(<Textarea disabled placeholder="Deshabilitado" resize="none" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
    expect(textarea.className).toContain('resize-none')
  })
})

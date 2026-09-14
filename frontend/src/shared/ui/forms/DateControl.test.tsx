import { createRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Field } from './index'
import { DateControl } from './DateControl'

describe('DateControl (C13)', () => {
  it('renders a native date input with default properties', () => {
    render(
      <DateControl aria-label="Fecha de registro" defaultValue="2026-09-13" />,
    )

    const input = screen.getByLabelText('Fecha de registro') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('date')
    expect(input.value).toBe('2026-09-13')
  })

  it('integrates with Field context for label, description and error association', () => {
    render(
      <Field
        error="Fecha fuera de rango"
        hint="Seleccione una fecha laboral"
        label="Fecha de cita"
      >
        <DateControl />
      </Field>,
    )

    const input = screen.getByLabelText('Fecha de cita')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      'Seleccione una fecha laboral Fecha fuera de rango',
    )
  })

  it('handles controlled value updates and triggers onChange', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    function ControlledComponent() {
      const [value, setValue] = useState('2026-01-01')
      return (
        <DateControl
          aria-label="Fecha controlada"
          onChange={(e) => {
            setValue(e.target.value)
            handleChange(e.target.value)
          }}
          value={value}
        />
      )
    }

    render(<ControlledComponent />)
    const input = screen.getByLabelText('Fecha controlada') as HTMLInputElement
    expect(input.value).toBe('2026-01-01')

    // Cambiar valor con fireEvent o userEvent
    await user.clear(input)
    await user.type(input, '2026-10-20')

    expect(handleChange).toHaveBeenCalled()
  })

  it('forwards ref correctly to the underlying HTMLInputElement', () => {
    const ref = createRef<HTMLInputElement>()
    render(<DateControl aria-label="Fecha con ref" ref={ref} />)

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(ref.current?.type).toBe('date')
  })

  it('respects disabled state', () => {
    render(<DateControl aria-label="Fecha deshabilitada" disabled />)

    const input = screen.getByLabelText('Fecha deshabilitada')
    expect(input).toBeDisabled()
  })

  it('applies custom radius and density variants', () => {
    const { rerender } = render(
      <DateControl
        aria-label="Fecha compacta r10"
        density="compact42"
        radius="r10"
      />,
    )

    let input = screen.getByLabelText('Fecha compacta r10')
    expect(input.className).toContain('rounded-group')
    expect(input.className).toContain('min-h-[42px]')

    rerender(
      <DateControl aria-label="Fecha standard r5" density="50" radius="r5" />,
    )

    input = screen.getByLabelText('Fecha standard r5')
    expect(input.className).toContain('rounded-control')
    expect(input.className).toContain('min-h-[50px]')
  })
})

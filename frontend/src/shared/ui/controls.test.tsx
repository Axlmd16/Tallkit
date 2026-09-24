import { render, screen } from '@testing-library/react'
import { User } from '@phosphor-icons/react'
import { describe, expect, it } from 'vitest'

import {
  Button,
  ButtonGroup,
  Checkbox,
  Field,
  IconButton,
  Input,
  Select,
} from './controls'

it('disables a pending action and names the operation in progress', () => {
  render(
    <Button pending pendingLabel="Guardando…">
      Guardar usuario
    </Button>,
  )

  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Guardando…' })).toHaveAttribute(
    'aria-busy',
    'true',
  )
})

it.each([
  ['primary', 'Guardar'],
  ['secondary', 'Cancelar'],
  ['quiet', 'Ver detalles'],
  ['danger', 'Eliminar'],
] as const)(
  'keeps the %s action natively named and operable',
  (variant, label) => {
    render(<Button variant={variant}>{label}</Button>)

    expect(screen.getByRole('button', { name: label })).toBeEnabled()
  },
)

it('keeps the soft action tinted at rest, not only on hover', () => {
  render(<Button variant="soft">Agregar servicio</Button>)

  const button = screen.getByRole('button', { name: 'Agregar servicio' })
  expect(button).toHaveClass('bg-accent-soft', 'text-accent')
  expect(button.className).not.toContain('bg-transparent')
})

it('gives an icon-only action an accessible name', () => {
  render(<IconButton icon={<User />} label="Ver usuario" />)

  expect(screen.getByRole('button', { name: 'Ver usuario' })).toBeEnabled()
})

it('associates field help and error with its input', () => {
  render(
    <Field
      error="Ingrese una identificación."
      hint="Use el nombre asignado por el administrador."
      id="username"
      label="Identificación de acceso"
    >
      <Input />
    </Field>,
  )

  const input = screen.getByRole('textbox', {
    name: 'Identificación de acceso',
  })
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription(
    'Use el nombre asignado por el administrador. Ingrese una identificación.',
  )
})

it('keeps select, checkbox and grouped actions natively operable', () => {
  render(
    <>
      <Field id="status" label="Estado">
        <Select defaultValue="active">
          <option value="active">Activo</option>
        </Select>
      </Field>
      <Checkbox label="Administrador" />
      <ButtonGroup label="Acciones del formulario">
        <Button>Guardar</Button>
        <Button variant="secondary">Cancelar</Button>
      </ButtonGroup>
    </>,
  )

  expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('active')
  expect(screen.getByRole('checkbox', { name: 'Administrador' })).toBeEnabled()
  expect(
    screen.getByRole('group', { name: 'Acciones del formulario' }),
  ).toBeInTheDocument()
})

describe('lenguaje Tallkit de los controles', () => {
  it('la acción principal usa el azul Tallkit y la secundaria un borde de campo', () => {
    render(
      <>
        <Button>Guardar</Button>
        <Button variant="secondary">Cancelar</Button>
        <Button variant="danger-solid">Anular venta</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Guardar' }).className).toMatch(
      /\bbg-primary\b.*\btext-white\b|\btext-white\b.*\bbg-primary\b/,
    )
    const secondary = screen.getByRole('button', { name: 'Cancelar' })
    expect(secondary.className).toMatch(/\bborder-line-strong\b/)
    expect(secondary.className).toMatch(/\bbg-surface\b/)
    expect(
      screen.getByRole('button', { name: 'Anular venta' }).className,
    ).toMatch(/\bbg-danger\b/)
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/\brounded-control\b/)
    }
  })

  it('los campos son blancos con borde de campo y foco petróleo', () => {
    render(
      <Field error="Revise el dato." id="c" label="Cantidad">
        <Input />
      </Field>,
    )
    const input = screen.getByLabelText('Cantidad')
    expect(input.className).toMatch(/\bbg-surface\b/)
    expect(input.className).toMatch(/\bborder-line-strong\b/)
    expect(input.className).toMatch(/focus:border-accent/)
    expect(input.className).not.toMatch(/bg-surface-muted|primary/)
    expect(screen.getByText('Cantidad').className).toMatch(/text-xs/)
  })

  it('un botón de icono ofrece al menos 44 px en táctil y ayuda textual', () => {
    render(<IconButton icon={<span />} label="Quitar" targetSize="touch44" />)
    const button = screen.getByRole('button', { name: 'Quitar' })
    expect(button).toHaveAttribute('title', 'Quitar')
    expect(button.className).toMatch(/size-11/)
  })
})

import { render, screen } from '@testing-library/react'
import { User } from '@phosphor-icons/react'
import { expect, it } from 'vitest'

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

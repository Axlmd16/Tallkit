import { createRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Field } from './index'
import { PasswordInput } from './PasswordInput'
import { SearchInput } from './SearchInput'

describe('C11: PasswordInput', () => {
  it('inicia en modo oculto (type="password") con acción de mostrar', () => {
    render(<PasswordInput placeholder="Contraseña secreta" />)
    const input = screen.getByPlaceholderText('Contraseña secreta')
    expect(input).toHaveAttribute('type', 'password')

    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' })
    expect(toggle).toBeInTheDocument()
  })

  it('alterna visibilidad local, conserva el texto y actualiza etiqueta accesible', async () => {
    const user = userEvent.setup()
    render(<PasswordInput placeholder="Clave" />)

    const input = screen.getByPlaceholderText('Clave')
    await user.type(input, 'SuperSecreto123')
    expect(input).toHaveValue('SuperSecreto123')

    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' })
    await user.click(toggle)

    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('SuperSecreto123')
    expect(
      screen.getByRole('button', { name: 'Ocultar contraseña' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveValue('SuperSecreto123')
  })

  it('reenvía ref nativa y se integra con Field', () => {
    const ref = createRef<HTMLInputElement>()
    render(
      <Field error="Clave insegura" id="password" label="Contraseña">
        <PasswordInput ref={ref} />
      </Field>,
    )

    const input = screen.getByLabelText('Contraseña')
    expect(input).toBe(ref.current)
    expect(input).toHaveAttribute('id', 'password')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('deshabilita el botón de alternar cuando el input está deshabilitado', () => {
    render(<PasswordInput disabled placeholder="Deshabilitada" />)
    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' })
    expect(toggle).toBeDisabled()
  })
})

describe('C12: SearchInput', () => {
  it('renderiza con icono decorativo de búsqueda y placeholder', () => {
    render(<SearchInput placeholder="Buscar por nombre o placa..." />)
    const input = screen.getByPlaceholderText('Buscar por nombre o placa...')
    expect(input).toBeInTheDocument()
  })

  it('muestra botón de limpiar al escribir y limpia texto + recupera foco al hacer click', async () => {
    const user = userEvent.setup()
    const handleClear = vi.fn()
    render(<SearchInput onClear={handleClear} placeholder="Buscar..." />)

    const input = screen.getByPlaceholderText('Buscar...')
    expect(
      screen.queryByRole('button', { name: 'Limpiar búsqueda' }),
    ).not.toBeInTheDocument()

    await user.type(input, 'Filtro activo')
    expect(input).toHaveValue('Filtro activo')

    const clearButton = screen.getByRole('button', { name: 'Limpiar búsqueda' })
    expect(clearButton).toBeInTheDocument()

    await user.click(clearButton)
    expect(input).toHaveValue('')
    expect(handleClear).toHaveBeenCalledTimes(1)
    expect(input).toHaveFocus()
    expect(
      screen.queryByRole('button', { name: 'Limpiar búsqueda' }),
    ).not.toBeInTheDocument()
  })

  it('soporta modo controlado con value y onChange', async () => {
    const user = userEvent.setup()
    function ControlledSearch() {
      const [value, setValue] = useState('Texto inicial')
      return (
        <SearchInput
          onChange={(e) => setValue(e.target.value)}
          onClear={() => setValue('')}
          placeholder="Controlado"
          value={value}
        />
      )
    }

    render(<ControlledSearch />)
    const input = screen.getByPlaceholderText('Controlado')
    expect(input).toHaveValue('Texto inicial')

    const clearButton = screen.getByRole('button', { name: 'Limpiar búsqueda' })
    await user.click(clearButton)
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
  })

  it('reenvía ref nativa y se integra con Field', () => {
    const ref = createRef<HTMLInputElement>()
    render(
      <Field
        hint="Presione Enter para filtrar"
        id="busqueda"
        label="Búsqueda rápida"
      >
        <SearchInput ref={ref} />
      </Field>,
    )

    const input = screen.getByLabelText('Búsqueda rápida')
    expect(input).toBe(ref.current)
    expect(input).toHaveAttribute('id', 'busqueda')
  })
})

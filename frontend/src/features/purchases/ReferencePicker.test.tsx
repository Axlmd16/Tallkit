import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { ReferencePicker, type PickerResults } from './ReferencePicker'

const results = (over: Partial<PickerResults> = {}): PickerResults => ({
  isPending: false,
  isError: false,
  data: {
    totalPages: 2,
    options: [
      { id: 1, label: 'Activo SA' },
      { id: 2, label: 'Cerrado SA', inactive: true },
    ],
  },
  ...over,
})

function setup(
  selected = null as null | { id: number; label: string; inactive?: boolean },
  over: Partial<PickerResults> = {},
) {
  const onSelect = vi.fn()
  const useOptions = vi.fn(() => results(over))
  render(
    <ReferencePicker
      id="picker"
      inactiveHelp="Ayuda inactivo"
      label="Proveedor"
      onSelect={onSelect}
      selected={selected}
      useOptions={useOptions}
    />,
  )
  return { onSelect, useOptions }
}

it('permite elegir una opción activa y no una inactiva', async () => {
  const { onSelect } = setup()
  expect(screen.getByText('Inactivo: no seleccionable')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Elegir' }))
  expect(onSelect).toHaveBeenCalledWith({ id: 1, label: 'Activo SA' })
})

it('pagina explícitamente y conserva la selección', async () => {
  const { useOptions } = setup({ id: 9, label: 'Elegido' })
  expect(screen.getByText('Elegido')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(useOptions).toHaveBeenLastCalledWith('', 2)
  await userEvent.click(
    screen.getByRole('button', { name: /Conservar «Elegido»/ }),
  )
  expect(screen.getByText('Elegido')).toBeInTheDocument()
})

it('etiqueta la selección inactiva y explica el bloqueo de confirmación', () => {
  setup({ id: 3, label: 'Viejo', inactive: true })
  expect(screen.getByText('Inactivo')).toBeInTheDocument()
  expect(screen.getByText('Ayuda inactivo')).toBeInTheDocument()
})

it('muestra carga, error recuperable y ausencia de coincidencias', () => {
  const refetch = vi.fn()
  const { unmount } = render(
    <ReferencePicker
      id="a"
      inactiveHelp=""
      label="A"
      onSelect={vi.fn()}
      selected={null}
      useOptions={() => results({ isPending: true, data: undefined })}
    />,
  )
  expect(screen.getByText('Buscando…')).toBeInTheDocument()
  unmount()
  const second = render(
    <ReferencePicker
      id="b"
      inactiveHelp=""
      label="B"
      onSelect={vi.fn()}
      selected={null}
      useOptions={() => results({ isError: true, data: undefined, refetch })}
    />,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo buscar')
  second.unmount()
  render(
    <ReferencePicker
      id="c"
      inactiveHelp=""
      label="C"
      onSelect={vi.fn()}
      selected={null}
      useOptions={() => results({ data: { totalPages: 1, options: [] } })}
    />,
  )
  expect(screen.getByText('Sin coincidencias.')).toBeInTheDocument()
})

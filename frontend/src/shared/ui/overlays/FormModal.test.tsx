import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { FormModal } from './FormModal'

function EditableExample({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [value, setValue] = useState('Toyota')
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button ref={triggerRef} type="button">
        Abrir
      </button>
      <FormModal
        dirty={value !== 'Toyota'}
        onClose={onClose}
        onSave={() => true}
        onSaveAndCreateAnother={() => {
          setValue('')
          return true
        }}
        open
        returnFocusRef={triggerRef}
        title="Nueva marca"
      >
        <label>
          Nombre
          <input
            data-autofocus
            onChange={(event) => setValue(event.target.value)}
            value={value}
          />
        </label>
      </FormModal>
    </>
  )
}

describe('FormModal Tallkit', () => {
  it('tiene nombre accesible, foco inicial y contención de foco', async () => {
    const user = userEvent.setup()
    render(<EditableExample />)

    const dialog = screen.getByRole('dialog', { name: 'Nueva marca' })
    const input = screen.getByRole('textbox', { name: 'Nombre' })
    await waitFor(() => expect(input).toHaveFocus())

    const save = screen.getByRole('button', { name: 'Guardar' })
    save.focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cerrar modal' })).toHaveFocus()
    expect(dialog).toBeVisible()
  })

  it.each(['Escape', 'Cerrar modal', 'Cancelar'])(
    'advierte cambios sin guardar al usar %s',
    async (action) => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<EditableExample onClose={onClose} />)
      const input = screen.getByRole('textbox', { name: 'Nombre' })
      await user.clear(input)
      await user.type(input, 'Hino')

      if (action === 'Escape') fireEvent.keyDown(input, { key: 'Escape' })
      else await user.click(screen.getByRole('button', { name: action }))

      const warning = screen.getByRole('dialog', {
        name: 'Hay cambios sin guardar',
      })
      expect(warning).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Nueva marca' })).toBeVisible()
    },
  )

  it('descarta después de confirmar la advertencia', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<EditableExample onClose={onClose} />)
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), ' X')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('guardar y crear otro limpia mediante el callback y devuelve el foco al primer campo', async () => {
    const user = userEvent.setup()
    render(<EditableExample />)
    const input = screen.getByRole('textbox', { name: 'Nombre' })

    await user.click(
      screen.getByRole('button', { name: 'Guardar y crear otro' }),
    )

    await waitFor(() => expect(input).toHaveValue(''))
    await waitFor(() => expect(input).toHaveFocus())
    expect(screen.getByRole('dialog', { name: 'Nueva marca' })).toBeVisible()
  })

  it('mantiene el modal abierto y muestra en línea un error del servidor', async () => {
    const user = userEvent.setup()
    render(
      <FormModal
        onClose={vi.fn()}
        onSave={() => Promise.reject(new Error('El nombre ya existe.'))}
        open
        title="Nueva marca"
      >
        <input aria-label="Nombre" data-autofocus />
      </FormModal>,
    )

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El nombre ya existe.',
    )
    expect(screen.getByRole('dialog', { name: 'Nueva marca' })).toBeVisible()
    expect(
      screen.queryByRole('status', { name: 'Notificaciones' }),
    ).not.toBeInTheDocument()
  })

  it('ocupa todo el ancho disponible por debajo de 640px', () => {
    render(
      <FormModal onClose={vi.fn()} onSave={vi.fn()} open title="Nuevo servicio">
        <input aria-label="Nombre" />
      </FormModal>,
    )
    expect(screen.getByRole('dialog', { name: 'Nuevo servicio' })).toHaveClass(
      'max-sm:max-w-none',
      'max-sm:rounded-none',
    )
  })

  it('permite deshabilitar la acción principal y nombrar la salida segura', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <FormModal
        cancelLabel="Abandonar sin confirmar"
        onClose={onClose}
        onSave={onSave}
        open
        saveDisabled
        saveLabel="Confirmar operación"
        title="Carga inicial y ajustes"
      >
        <input aria-label="Motivo" />
      </FormModal>,
    )
    const save = screen.getByRole('button', { name: 'Confirmar operación' })
    expect(save).toBeDisabled()
    fireEvent.submit(save.closest('form') ?? save)
    expect(onSave).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole('button', { name: 'Abandonar sin confirmar' }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

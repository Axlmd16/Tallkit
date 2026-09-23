import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Combobox, type ComboboxOption, type ComboboxResults } from './Combobox'

const active: ComboboxOption = {
  id: 1,
  label: 'FLT-0915 · Filtro de aceite',
  detail: 'Disponible · 24',
}
const second: ComboboxOption = {
  id: 2,
  label: 'ACE-1030 · Aceite 10W-30',
  detail: 'Disponible · 18',
}
const inactive: ComboboxOption = {
  id: 3,
  label: 'REF-0450 · Refrigerante',
  inactive: true,
}

function results(
  options: ComboboxOption[] = [active, second],
  totalPages = 1,
): ComboboxResults {
  return { data: { options, totalPages }, isError: false, isPending: false }
}

function renderCombobox(
  overrides: Partial<React.ComponentProps<typeof Combobox>> = {},
) {
  const onSelect = vi.fn()
  const useOptions = vi.fn(() => results())
  const view = render(
    <Combobox
      id="product"
      inactiveHelp="Solo se conserva en documentos históricos."
      label="Producto"
      onSelect={onSelect}
      selected={null}
      useOptions={useOptions}
      {...overrides}
    />,
  )
  return { ...view, onSelect, useOptions }
}

describe('Combobox compartido', () => {
  it('implementa el patrón ARIA y elige con flechas y Enter', async () => {
    const { onSelect } = renderCombobox()
    const input = screen.getByRole('combobox', { name: 'Producto' })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      'product-listbox-option-1',
    )
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(second)
  })

  it('cierra con Escape sin seleccionar', () => {
    const { onSelect } = renderCombobox()
    const input = screen.getByRole('combobox', { name: 'Producto' })
    fireEvent.focus(input)
    expect(screen.getByRole('listbox')).toBeVisible()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('pagina con AvPág y RePág', async () => {
    const useOptions = vi.fn((_term: string, page: number) =>
      results(page === 1 ? [active] : [second], 2),
    )
    renderCombobox({ useOptions })
    const input = screen.getByRole('combobox', { name: 'Producto' })
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'PageDown' })
    await waitFor(() => expect(screen.getByText('Página 2 de 2')).toBeVisible())
    expect(useOptions).toHaveBeenLastCalledWith('', 2)
    fireEvent.keyDown(input, { key: 'PageUp' })
    await waitFor(() => expect(screen.getByText('Página 1 de 2')).toBeVisible())
  })

  it('no permite seleccionar referencias inactivas', () => {
    const { onSelect } = renderCombobox({
      useOptions: () => results([inactive]),
    })
    const input = screen.getByRole('combobox', { name: 'Producto' })
    fireEvent.focus(input)
    const option = screen.getByRole('option', {
      name: /REF-0450.*Inactivo: no seleccionable/,
    })
    expect(option).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(option)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('limpia la selección y devuelve el foco al control', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderCombobox({ clearable: true, selected: active })
    await user.click(
      screen.getByRole('button', {
        name: `Quitar selección: ${active.label}`,
      }),
    )
    expect(onSelect).toHaveBeenCalledWith(null)
    expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveFocus()
  })

  it('renderiza los resultados en un portal fuera del contenedor', () => {
    const { container } = renderCombobox()
    fireEvent.focus(screen.getByRole('combobox', { name: 'Producto' }))
    const listbox = screen.getByRole('listbox')
    expect(document.body).toContainElement(listbox)
    expect(container).not.toContainElement(listbox)
  })
})

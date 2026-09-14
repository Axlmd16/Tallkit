import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FilterPanel } from './index'

describe('FilterPanel (C20)', () => {
  it('renders search role and label properly', () => {
    render(
      <FilterPanel label="Filtros de búsqueda">
        <div>Campos de filtro</div>
      </FilterPanel>,
    )

    const panel = screen.getByRole('search', { name: 'Filtros de búsqueda' })
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveTextContent('Campos de filtro')
    expect(panel.className).toContain('filter-panel')
  })

  it('supports inline and compact layout variants without .list-page', () => {
    const { rerender } = render(
      <FilterPanel label="Filtros en línea" layout="inline">
        <span>Filtro A</span>
      </FilterPanel>,
    )

    let panel = screen.getByRole('search', { name: 'Filtros en línea' })
    expect(panel.className).toContain('flex')

    rerender(
      <FilterPanel label="Filtros compactos" layout="compact">
        <span>Filtro B</span>
      </FilterPanel>,
    )

    panel = screen.getByRole('search', { name: 'Filtros compactos' })
    expect(panel.className).toContain('grid')
  })

  it('renders clear action when onClear callback is provided', async () => {
    const user = userEvent.setup()
    const handleClear = vi.fn()

    render(
      <FilterPanel
        clearLabel="Limpiar criterios"
        label="Filtros con limpieza"
        onClear={handleClear}
      >
        <span>Controles de filtro</span>
      </FilterPanel>,
    )

    const clearBtn = screen.getByRole('button', { name: 'Limpiar criterios' })
    expect(clearBtn).toBeInTheDocument()

    await user.click(clearBtn)
    expect(handleClear).toHaveBeenCalledTimes(1)
  })
})

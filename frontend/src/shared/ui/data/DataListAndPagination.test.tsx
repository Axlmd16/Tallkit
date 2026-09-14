import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '../controls'
import { DropdownMenu } from '../overlays/DropdownMenu'
import { DataList } from './DataList'
import { Pagination } from './Pagination'
import { RowActions } from './RowActions'

interface MockCustomer {
  id: string
  name: string
  category: string
  phone: string
}

const mockCustomers: MockCustomer[] = [
  {
    id: '1',
    name: 'Alejandro Morales',
    category: 'Frecuente',
    phone: '099111222',
  },
  { id: '2', name: 'Beatriz Solís', category: 'Nuevo', phone: '099333444' },
  {
    id: '3',
    name: 'Carlos Delgado',
    category: 'Frecuente',
    phone: '099555666',
  },
]

describe('DataList, Pagination y RowActions (C35, C36, C38) - Fase 8.3', () => {
  it('renders DataList as a flat list with metadata and actions', () => {
    render(
      <DataList
        items={mockCustomers}
        keyExtractor={(c) => c.id}
        label="Directorio de Clientes"
        renderItem={(c) => (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-ink">{c.name}</p>
              <p className="text-xs text-ink-muted">{c.phone}</p>
            </div>
            <RowActions>
              <Button size="40" variant="secondary">
                Editar
              </Button>
            </RowActions>
          </div>
        )}
      />,
    )

    const list = screen.getByRole('list', { name: 'Directorio de Clientes' })
    expect(list).toBeVisible()
    expect(within(list).getByText('Alejandro Morales')).toBeVisible()
    expect(within(list).getByText('099111222')).toBeVisible()
    expect(
      within(list).getAllByRole('button', { name: 'Editar' }),
    ).toHaveLength(3)
  })

  it('renders DataList grouped by category with semantic headers', () => {
    render(
      <DataList
        groupBy={(c) => c.category}
        items={mockCustomers}
        keyExtractor={(c) => c.id}
        label="Clientes por Categoría"
        renderItem={(c) => <span>{c.name}</span>}
      />,
    )

    expect(
      screen.getByRole('region', { name: /Clientes por Categoría/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Frecuente' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Nuevo' }),
    ).toBeVisible()

    const frequentGroup = screen.getByRole('group', { name: 'Frecuente' })
    expect(within(frequentGroup).getByText('Alejandro Morales')).toBeVisible()
    expect(within(frequentGroup).getByText('Carlos Delgado')).toBeVisible()
  })

  it('wraps long unbroken identifiers inside DataList items cleanly', () => {
    const longId =
      'cliente-con-clave-muy-larga-sin-espacios-para-verificar-el-ajuste-responsivo'
    render(
      <DataList
        items={[{ id: '99', name: longId, category: 'General', phone: '000' }]}
        keyExtractor={(c) => c.id}
        label="Lista con texto largo"
        renderItem={(c) => <span className="break-words">{c.name}</span>}
      />,
    )

    const item = screen.getByText(longId)
    expect(item).toHaveClass('break-words')
  })

  it('handles Pagination with boundary conditions and zero/one total items', () => {
    const handleNext = vi.fn()
    const handlePrev = vi.fn()

    const { rerender } = render(
      <Pagination
        onNext={handleNext}
        onPrevious={handlePrev}
        page={1}
        totalPages={0}
      />,
    )

    // Total 0 se normaliza a 1 y ambos botones se deshabilitan
    expect(
      screen.getByRole('button', { name: 'Página anterior' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Página siguiente' }),
    ).toBeDisabled()
    expect(screen.getByText('Página 1 de 1')).toBeVisible()

    // Total 1
    rerender(
      <Pagination
        onNext={handleNext}
        onPrevious={handlePrev}
        page={1}
        totalPages={1}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Página anterior' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Página siguiente' }),
    ).toBeDisabled()

    // Total 3, en página 2
    rerender(
      <Pagination
        onNext={handleNext}
        onPrevious={handlePrev}
        page={2}
        totalItems={25}
        totalPages={3}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Página anterior' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Página siguiente' }),
    ).toBeEnabled()
    expect(screen.getByText('Página 2 de 3 (25 registros)')).toBeVisible()
  })

  it('RowActions composes direct actions and dropdown menu trigger', async () => {
    const user = userEvent.setup()
    render(
      <RowActions label="Acciones de vehículo">
        <Button size="40" variant="secondary">
          Ver
        </Button>
        <DropdownMenu
          items={[
            { id: 'edit', label: 'Editar ficha' },
            { id: 'del', label: 'Eliminar', destructive: true },
          ]}
          trigger={
            <Button size="40" variant="quiet">
              Más
            </Button>
          }
        />
      </RowActions>,
    )

    const group = screen.getByRole('group', { name: 'Acciones de vehículo' })
    expect(group).toBeVisible()
    expect(within(group).getByRole('button', { name: 'Ver' })).toBeVisible()

    const moreBtn = within(group).getByRole('button', { name: 'Más' })
    await user.click(moreBtn)
    expect(screen.getByRole('menu')).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Editar ficha' })).toBeVisible()
  })
})

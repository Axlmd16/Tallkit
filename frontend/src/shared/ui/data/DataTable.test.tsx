import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DataTable } from './DataTable'

interface MockItem {
  id: string
  plate: string
  brand: string
  year: number
  status: string
}

const mockRows: MockItem[] = [
  { id: '1', plate: 'P-1234', brand: 'Toyota', year: 2021, status: 'Activo' },
  {
    id: '2',
    plate: 'P-5678',
    brand: 'Chevrolet',
    year: 2019,
    status: 'En Bahía',
  },
]

const columns = [
  { header: 'Placa', key: 'plate', priority: 'primary' as const },
  { header: 'Marca', key: 'brand', priority: 'primary' as const },
  { header: 'Año', key: 'year', priority: 'secondary' as const },
  { header: 'Estado', key: 'status', priority: 'secondary' as const },
]

describe('DataTable (C34) - Fase 8.1', () => {
  it('renders default elevated table and accessible mobile card list', () => {
    render(
      <DataTable
        columns={columns}
        getRowKey={(row) => row.id}
        label="Flota de Vehículos"
        rows={mockRows}
      />,
    )

    const table = screen.getByRole('table', { name: 'Flota de Vehículos' })
    expect(table).toBeVisible()
    expect(table.className).toContain('border-separate')

    const mobileList = screen.getByRole('list', {
      name: 'Flota de Vehículos en pantalla estrecha',
    })
    expect(mobileList).toBeVisible()
    expect(within(mobileList).getByText('P-1234')).toBeVisible()
  })

  it('renders contained table variant with border-collapse and dividing lines', () => {
    render(
      <DataTable
        columns={columns}
        getRowKey={(row) => row.id}
        label="Historial Contenido"
        rows={mockRows}
        variant="contained"
      />,
    )

    const table = screen.getByRole('table', { name: 'Historial Contenido' })
    expect(table).toBeVisible()
    expect(table.className).toContain('border-collapse')
  })

  it('applies rowHeight 70px (F03 4:661/4:964) and 60px (F07 4:3086) variants', () => {
    const { rerender } = render(
      <DataTable
        columns={columns}
        getRowKey={(row) => row.id}
        label="Tabla 70px"
        rowHeight="70"
        rows={mockRows}
      />,
    )

    const row70Cells = screen.getAllByRole('cell', { name: 'P-1234' })
    expect(row70Cells[0]?.className).toMatch(/h-\[70px\]|py-5/)

    rerender(
      <DataTable
        columns={columns}
        getRowKey={(row) => row.id}
        label="Tabla 60px"
        rowHeight="60"
        rows={mockRows}
      />,
    )

    const row60Cells = screen.getAllByRole('cell', { name: 'P-1234' })
    expect(row60Cells[0]?.className).toMatch(/h-\[60px\]|py-3\.5/)
  })

  it('renders custom cell renderers and actions slot', () => {
    render(
      <DataTable
        actions={(row) => <button type="button">Detalle {row.plate}</button>}
        columns={[
          ...columns,
          {
            header: 'Etiqueta',
            key: 'tag',
            render: (row) => <span>TAG-{row.id}</span>,
          },
        ]}
        getRowKey={(row) => row.id}
        label="Tabla con Acciones"
        rows={mockRows}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: 'Detalle P-1234' })[0],
    ).toBeVisible()
    expect(screen.getAllByText('TAG-1')[0]).toBeVisible()
  })

  it('opens a row through click or keyboard without hijacking row actions', async () => {
    const user = userEvent.setup()
    const handleRowClick = vi.fn()

    render(
      <DataTable
        actions={(row) => <button type="button">Editar {row.plate}</button>}
        columns={columns}
        getRowKey={(row) => row.id}
        label="Tabla seleccionable"
        onRowClick={handleRowClick}
        rows={mockRows}
      />,
    )

    await user.click(screen.getAllByRole('cell', { name: 'P-1234' })[0]!)
    expect(handleRowClick).toHaveBeenCalledWith(mockRows[0])

    await user.click(
      screen.getAllByRole('button', { name: 'Editar P-1234' })[0]!,
    )
    expect(handleRowClick).toHaveBeenCalledTimes(1)

    const row = screen
      .getAllByRole('row')
      .find((candidate) => candidate.textContent?.includes('P-1234'))
    expect(row).toBeDefined()
    row?.focus()
    await user.keyboard('{Enter}')
    expect(handleRowClick).toHaveBeenCalledTimes(2)
  })

  it('handles controlled row selection and indeterminate header state', async () => {
    const user = userEvent.setup()
    const handleSelectRow = vi.fn()
    const handleSelectAll = vi.fn()

    const { rerender } = render(
      <DataTable
        columns={columns}
        getRowKey={(row) => row.id}
        label="Tabla con Selección"
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        rows={mockRows}
        selectedKeys={['1']}
      />,
    )

    // Checkbox en thead debe estar indeterminado (1 de 2 seleccionados)
    const selectAllCheckbox = screen.getByRole('checkbox', {
      name: 'Seleccionar todas las filas',
    }) as HTMLInputElement
    expect(selectAllCheckbox.indeterminate).toBe(true)
    expect(selectAllCheckbox).toHaveAttribute('aria-checked', 'mixed')

    // Checkbox de fila 1 está marcado, fila 2 no
    const row1Checkbox = screen.getByRole('checkbox', {
      name: 'Seleccionar fila 1',
    })
    const row2Checkbox = screen.getByRole('checkbox', {
      name: 'Seleccionar fila 2',
    })
    expect(row1Checkbox).toBeChecked()
    expect(row2Checkbox).not.toBeChecked()

    // Click en checkbox de fila 2 dispara callback
    await user.click(row2Checkbox)
    expect(handleSelectRow).toHaveBeenCalledWith('2', true)

    // Click en selectAll dispara callback
    await user.click(selectAllCheckbox)
    expect(handleSelectAll).toHaveBeenCalledWith(true)

    // Cuando todos están seleccionados
    rerender(
      <DataTable
        columns={columns}
        getRowKey={(row) => row.id}
        label="Tabla con Selección"
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        rows={mockRows}
        selectedKeys={['1', '2']}
      />,
    )
    expect(selectAllCheckbox.indeterminate).toBe(false)
    expect(selectAllCheckbox).toBeChecked()
    expect(selectAllCheckbox).toHaveAttribute('aria-checked', 'true')
  })

  it('supports controlled sort with aria-sort on sortable columns', async () => {
    const user = userEvent.setup()
    const handleSort = vi.fn()

    const sortableColumns = [
      { header: 'Placa', key: 'plate', sortable: true },
      { header: 'Marca', key: 'brand', sortable: false },
    ]

    render(
      <DataTable
        columns={sortableColumns}
        getRowKey={(row) => row.id}
        label="Tabla Ordenable"
        onSort={handleSort}
        rows={mockRows}
        sortColumn="plate"
        sortDirection="ascending"
      />,
    )

    const plateHeader = screen.getByRole('columnheader', { name: /Placa/ })
    expect(plateHeader).toHaveAttribute('aria-sort', 'ascending')

    const brandHeader = screen.getByRole('columnheader', { name: 'Marca' })
    expect(brandHeader).not.toHaveAttribute('aria-sort')

    const sortButton = within(plateHeader).getByRole('button', {
      name: /Placa/,
    })
    await user.click(sortButton)

    expect(handleSort).toHaveBeenCalledWith('plate', 'descending')
  })
})

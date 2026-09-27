import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { Button } from './controls'
import {
  ElevatedDataList,
  FilterPanel,
  PageHeader,
  Pagination,
  ResponsiveDataView,
  Surface,
  Toolbar,
} from './layout'

const rows = [{ id: 1, name: 'ana', roles: 'Administrador', state: 'Activo' }]

it('keeps page context and its primary action together', () => {
  render(
    <PageHeader
      actions={<Button>Crear usuario</Button>}
      description="Cuentas internas y sus roles vigentes."
      title="Usuarios"
    />,
  )

  expect(screen.getByRole('heading', { name: 'Usuarios' })).toHaveClass(
    'text-[22px]',
    'font-bold',
  )
  expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeEnabled()
})

it('labels filter and toolbar regions', () => {
  render(
    <>
      <Toolbar label="Acciones de usuarios">Contenido</Toolbar>
      <FilterPanel label="Filtros de usuarios">Filtros</FilterPanel>
    </>,
  )

  expect(
    screen.getByRole('toolbar', { name: 'Acciones de usuarios' }),
  ).toBeVisible()
  expect(
    screen.getByRole('search', { name: 'Filtros de usuarios' }),
  ).toHaveClass('rounded-panel', 'border', 'border-line', 'bg-surface')
})

it('provides comparable desktop columns and complete mobile detail', () => {
  render(
    <ResponsiveDataView
      columns={[
        { header: 'Usuario', key: 'name', priority: 'primary' },
        { header: 'Roles', key: 'roles', priority: 'secondary' },
        { header: 'Estado', key: 'state', priority: 'primary' },
      ]}
      getRowKey={(row) => row.id}
      label="Usuarios"
      rows={rows}
    />,
  )

  const table = screen.getByRole('table', { name: 'Usuarios' })
  expect(
    within(table).getByRole('columnheader', { name: 'Roles' }),
  ).toBeVisible()
  const mobile = screen.getByRole('list', {
    name: 'Usuarios en pantalla estrecha',
  })
  expect(within(mobile).getByText('Administrador')).toBeVisible()
})

it('disables pagination at its boundaries', () => {
  render(
    <Pagination
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      page={1}
      totalPages={1}
    />,
  )

  expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Página siguiente' }),
  ).toBeDisabled()
  expect(screen.getByText('Página 1 de 1')).toBeVisible()
})

it('composes elevated surfaces as labelled regions', () => {
  render(
    <Surface aria-label="Resumen de usuarios">
      <p>Usuarios activos</p>
    </Surface>,
  )

  expect(
    screen.getByRole('region', { name: 'Resumen de usuarios' }),
  ).toHaveClass('rounded-panel', 'border', 'border-line')
})

it('keeps the elevated data list comparable and complete on narrow screens', () => {
  render(
    <ElevatedDataList
      columns={[
        { header: 'Usuario', key: 'name', priority: 'primary' },
        { header: 'Roles', key: 'roles', priority: 'secondary' },
      ]}
      getRowKey={(row) => row.id}
      label="Directorio"
      rows={rows}
    />,
  )

  expect(screen.getByRole('table', { name: 'Directorio' })).toBeVisible()
  expect(
    screen.getByRole('list', { name: 'Directorio en pantalla estrecha' }),
  ).toBeVisible()
})

it('allows unbroken operational data to wrap inside narrow cards', () => {
  const longIdentifier =
    'usuario-con-identificador-extraordinariamente-largo-sin-separadores'
  render(
    <ElevatedDataList
      columns={[{ header: 'Usuario', key: 'name', priority: 'primary' }]}
      getRowKey={(row) => row.id}
      label="Directorio"
      rows={[{ id: 2, name: longIdentifier }]}
    />,
  )

  const narrowList = screen.getByRole('list', {
    name: 'Directorio en pantalla estrecha',
  })
  expect(within(narrowList).getByText(longIdentifier)).toHaveClass(
    'break-words',
  )
})

it('passes row selection to desktop and narrow presentations', async () => {
  const onSelectRow = vi.fn()
  const onSelectAll = vi.fn()
  render(
    <ElevatedDataList
      columns={[{ header: 'Usuario', key: 'name', priority: 'primary' }]}
      getRowKey={(row) => row.id}
      label="Directorio"
      onSelectAll={onSelectAll}
      onSelectRow={onSelectRow}
      rows={rows}
      selectedKeys={new Set([1])}
    />,
  )

  const desktop = screen.getByRole('table', { name: 'Directorio' })
  const narrow = screen.getByRole('list', {
    name: 'Directorio en pantalla estrecha',
  })
  expect(
    within(desktop).getByRole('checkbox', { name: 'Seleccionar fila 1' }),
  ).toBeChecked()
  expect(within(narrow).getByRole('checkbox')).toBeChecked()

  await userEvent.click(
    within(desktop).getByRole('checkbox', { name: 'Seleccionar fila 1' }),
  )
  expect(onSelectRow).toHaveBeenCalledWith(1, false)
  await userEvent.click(
    within(desktop).getByRole('checkbox', {
      name: 'Seleccionar todas las filas',
    }),
  )
  expect(onSelectAll).toHaveBeenCalledWith(false)
})

it('does not render selection controls when handlers are absent', () => {
  render(
    <ElevatedDataList
      columns={[{ header: 'Usuario', key: 'name', priority: 'primary' }]}
      getRowKey={(row) => row.id}
      label="Directorio"
      rows={rows}
    />,
  )

  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

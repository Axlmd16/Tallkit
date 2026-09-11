import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { Button } from './controls'
import {
  ElevatedDataList,
  FilterPanel,
  PageHeader,
  Pagination,
  ResponsiveDataView,
  StatCard,
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

  expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeVisible()
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
  ).toBeVisible()
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

it('composes elevated surfaces and operational statistics without inventing navigation', () => {
  render(
    <Surface aria-label="Resumen de usuarios">
      <StatCard label="Usuarios activos" value="12" />
    </Surface>,
  )

  expect(
    screen.getByRole('region', { name: 'Resumen de usuarios' }),
  ).toBeVisible()
  expect(screen.getByText('Usuarios activos')).toBeVisible()
  expect(screen.getByText('12')).toBeVisible()
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

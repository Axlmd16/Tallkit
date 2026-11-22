import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ permissions: [] as string[] }))
vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('./BusinessCards', () => ({
  BusinessCards: () => <div>Tarjetas de negocios</div>,
}))

import { SettingsPage } from './SettingsPage'

beforeEach(() => {
  mocks.permissions = []
})

function renderSettings(initial = '/settings') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <SettingsPage />
    </MemoryRouter>,
  )
}

it('muestra cada pestaña solo con su permiso', () => {
  mocks.permissions = ['usuarios.ver', 'proveedores.ver']
  renderSettings()
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'Personas con acceso',
    'Proveedores',
  ])
  expect(screen.queryByRole('tab', { name: 'Historial de cambios' })).toBeNull()
  expect(
    screen.queryByRole('link', { name: /Repetir la guía inicial/ }),
  ).toBeNull()
})

it('el Administrador ve las seis pestañas y el acceso a la guía inicial', async () => {
  mocks.permissions = [
    'proveedores.ver',
    'marcas_vehiculo.ver',
    'productos.ver',
    'usuarios.ver',
    'auditoria.ver',
    'operacion.ver_estado',
    'parametros.gestionar',
  ]
  renderSettings()
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'Negocios',
    'Personas con acceso',
    'Proveedores',
    'Marcas',
    'Historial de cambios',
    'Sistema',
  ])
  expect(screen.getByText('Tarjetas de negocios')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /Repetir la guía inicial/ }),
  ).toHaveAttribute('href', '/configuration/setup')

  await userEvent.click(screen.getByRole('tab', { name: 'Marcas' }))
  expect(
    screen.getByRole('link', { name: /Marcas de vehículos/ }),
  ).toHaveAttribute('href', '/vehicle-brands')
})

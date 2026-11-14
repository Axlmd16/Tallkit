import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ permissions: [] as string[] }))
vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))

import { SettingsPage } from './SettingsPage'

beforeEach(() => {
  mocks.permissions = []
})

function options() {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
  return within(screen.getByRole('list', { name: 'Opciones de ajustes' }))
}

it('muestra cada opción solo con su permiso', () => {
  mocks.permissions = ['usuarios.ver', 'proveedores.ver']
  const list = options()
  expect(
    list.getAllByRole('link').map((link) => link.getAttribute('href')),
  ).toEqual(['/suppliers', '/users'])
  expect(list.queryByRole('link', { name: /Auditoría/ })).toBeNull()
})

it('el Administrador llega a todas las opciones, con su descripción', () => {
  mocks.permissions = [
    'proveedores.ver',
    'marcas_vehiculo.ver',
    'productos.ver',
    'usuarios.ver',
    'auditoria.ver',
    'operacion.ver_estado',
    'parametros.gestionar',
  ]
  const list = options()
  expect(list.getAllByRole('link')).toHaveLength(9)
  expect(list.getByRole('link', { name: /Configuración/ })).toHaveAttribute(
    'href',
    '/configuration',
  )
})

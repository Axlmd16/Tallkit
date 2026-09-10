import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  users: {} as Record<string, unknown>,
  roles: {} as Record<string, unknown>,
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  resetPassword: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/users/hooks', () => ({
  useUsers: () => mocks.users,
  useRoles: () => mocks.roles,
  useUserMutations: () => ({
    create: { mutateAsync: mocks.create },
    update: { mutateAsync: mocks.update },
    activate: { mutateAsync: mocks.activate },
    deactivate: { mutateAsync: mocks.deactivate },
    resetPassword: { mutateAsync: mocks.resetPassword },
  }),
}))

import { UsersPage } from './UsersPage'

const record = {
  id: 2,
  username: 'ana',
  first_name: 'Ana',
  last_name: 'Pérez',
  email: '',
  is_active: true,
  roles: ['VENDEDOR'],
}

beforeEach(() => {
  vi.restoreAllMocks()
  Object.values(mocks).forEach((value) => {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset()
  })
  mocks.permissions = []
  mocks.roles = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: [
      { code: 'ADMINISTRADOR', permissions: ['usuarios.ver'] },
      { code: 'VENDEDOR', permissions: [] },
      { code: 'ENCARGADO_TALLER', permissions: [] },
    ],
  }
  mocks.users = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { results: [record], page: 1, total_pages: 1 },
  }
})

it('shows states and hides every administrative action without permission', () => {
  render(<UsersPage />)

  expect(screen.getByText('ana')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Crear usuario' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Editar' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Desactivar' }),
  ).not.toBeInTheDocument()
})

it('renders an explicit empty result', () => {
  mocks.users = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { results: [], page: 1, total_pages: 0 },
  }
  render(<UsersPage />)

  expect(
    screen.getByText('No hay usuarios que coincidan con los filtros.'),
  ).toBeInTheDocument()
})

it('explains the last active administrator conflict', async () => {
  mocks.permissions = ['usuarios.desactivar']
  mocks.deactivate.mockRejectedValue(
    new ProblemError('Conflicto.', 409, 'last_active_administrator'),
  )
  Object.defineProperty(window, 'confirm', {
    configurable: true,
    value: vi.fn(() => true),
  })
  const user = userEvent.setup()
  render(<UsersPage />)

  await user.click(screen.getByRole('button', { name: 'Desactivar' }))

  expect(await screen.findByRole('status')).toHaveTextContent(
    'No se puede desactivar el último Administrador activo.',
  )
})

it('shows a reset credential once and removes it when acknowledged', async () => {
  mocks.permissions = ['usuarios.restablecer_clave']
  mocks.resetPassword.mockResolvedValue({ temporary_password: 'Temporal-2026' })
  Object.defineProperty(window, 'confirm', {
    configurable: true,
    value: vi.fn(() => true),
  })
  const user = userEvent.setup()
  render(<UsersPage />)

  await user.click(
    screen.getByRole('button', { name: 'Restablecer contraseña' }),
  )
  expect(await screen.findByRole('dialog')).toHaveTextContent('Temporal-2026')
  await user.click(screen.getByRole('button', { name: 'Ya la copié' }))
  expect(screen.queryByText('Temporal-2026')).not.toBeInTheDocument()
})

it('covers filters, creation, editing, activation and pagination', async () => {
  mocks.permissions = [
    'usuarios.crear',
    'usuarios.editar',
    'usuarios.desactivar',
  ]
  mocks.users = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      results: [
        record,
        { ...record, id: 3, username: 'inactiva', is_active: false },
      ],
      page: 2,
      total_pages: 3,
    },
  }
  Object.defineProperty(window, 'confirm', {
    configurable: true,
    value: vi.fn(() => true),
  })
  const user = userEvent.setup()
  render(<UsersPage />)

  await user.type(screen.getByLabelText('Buscar'), 'ana')
  await user.selectOptions(screen.getByLabelText('Estado'), 'true')
  await user.selectOptions(screen.getByLabelText('Estado'), '')
  await user.selectOptions(screen.getByLabelText('Rol'), 'VENDEDOR')
  await user.selectOptions(screen.getByLabelText('Rol'), '')
  await user.click(screen.getByRole('button', { name: 'Anterior' }))
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))

  await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
  await user.type(screen.getByLabelText('Identificación de acceso'), ' nueva ')
  await user.type(screen.getByLabelText('Nombres'), 'Nueva')
  await user.type(screen.getByLabelText('Apellidos'), 'Persona')
  await user.type(screen.getByLabelText('Correo opcional'), 'nueva@example.com')
  await user.click(screen.getByLabelText('Vendedor'))
  await user.click(screen.getByRole('button', { name: 'Guardar usuario' }))
  expect(mocks.create).toHaveBeenCalled()

  const activeRow = screen.getByRole('row', { name: /ana/ })
  await user.click(activeRow.getElementsByTagName('button')[0]!)
  await user.clear(screen.getByLabelText('Nombres'))
  await user.type(screen.getByLabelText('Nombres'), 'Editada')
  await user.click(screen.getByRole('button', { name: 'Guardar usuario' }))
  expect(mocks.update).toHaveBeenCalled()

  await user.click(
    screen.getByRole('row', { name: /ana/ }).getElementsByTagName('button')[1]!,
  )
  await user.click(
    screen
      .getByRole('row', { name: /inactiva/ })
      .getElementsByTagName('button')[1]!,
  )
  expect(mocks.deactivate).toHaveBeenCalledWith(2)
  expect(mocks.activate).toHaveBeenCalledWith(3)
})

it.each([
  ['Cargando usuarios…', { isPending: true, isError: false, isSuccess: false }],
  [
    'No fue posible cargar los usuarios.',
    { isPending: false, isError: true, isSuccess: false },
  ],
])('renders user state %s', (message, state) => {
  mocks.users = state
  render(<UsersPage />)
  expect(screen.getByText(message)).toBeInTheDocument()
})

it.each([
  ['Cargando roles…', { isPending: true, isError: false, isSuccess: false }],
  [
    'No fue posible consultar los roles.',
    { isPending: false, isError: true, isSuccess: false },
  ],
])('renders role state %s', (message, state) => {
  mocks.roles = state
  render(<UsersPage />)
  expect(screen.getByText(message)).toBeInTheDocument()
})

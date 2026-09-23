import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  submit: { name: 'Ana Pérez' } as object,
  detail: { data: undefined as unknown, isPending: false, isError: false },
}))

vi.mock('@/features/customers/hooks', () => ({
  useCustomer: () => ({ ...mocks.detail, refetch: vi.fn() }),
  useCustomerMutations: () => ({
    create: { mutateAsync: mocks.create },
    update: { mutateAsync: mocks.update },
  }),
}))

// El formulario real tiene sus propias pruebas; aquí se aísla el comportamiento de la página.
vi.mock('@/features/customers/CustomerForm', () => ({
  CustomerForm: ({
    onSubmit,
    onDirtyChange,
    onCancel,
  }: {
    onSubmit: (data: object) => Promise<void>
    onDirtyChange: (dirty: boolean) => void
    onCancel: () => void
  }) => (
    <form aria-label="Formulario de cliente">
      <label htmlFor="s-name">Nombre</label>
      <input id="s-name" onChange={() => onDirtyChange(true)} />
      <button onClick={() => void onSubmit(mocks.submit)} type="button">
        Guardar cliente
      </button>
      <button onClick={onCancel} type="button">
        Cancelar
      </button>
    </form>
  ),
}))

import { CustomerEditorPage } from './CustomerEditorPage'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/customers', element: <p>Lista de clientes</p> },
      { path: '/customers/new', element: <CustomerEditorPage /> },
      { path: '/customers/:id/edit', element: <CustomerEditorPage /> },
      { path: '/customers/:id', element: <p>Ficha de cliente</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.submit = { name: 'Ana Pérez' }
  mocks.detail = { data: undefined, isPending: false, isError: false }
})

it('crea el cliente, abre su ficha y lo confirma con un toast con enlace', async () => {
  mocks.create.mockResolvedValue({ id: 4, name: 'Ana Pérez', version: 1 })
  const user = userEvent.setup()
  const router = renderAt('/customers/new')
  expect(
    screen.getByRole('heading', { level: 1, name: 'Nuevo cliente' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
  expect(await screen.findByText('Ficha de cliente')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/customers/4')
  expect(mocks.create).toHaveBeenCalledWith({ name: 'Ana Pérez' })
  expect(screen.getByRole('link', { name: 'Ver' })).toHaveAttribute(
    'href',
    '/customers/4',
  )
  expect(
    screen.getByText('Cliente «Ana Pérez» registrado.'),
  ).toBeInTheDocument()
})

it('edita el cliente y vuelve a su ficha', async () => {
  mocks.detail = {
    data: { id: 5, name: 'Carlos Vera', version: 3 },
    isPending: false,
    isError: false,
  }
  mocks.update.mockResolvedValue({ id: 5, name: 'Ana Pérez', version: 4 })
  const user = userEvent.setup()
  renderAt('/customers/5/edit')
  expect(
    screen.getByRole('heading', { level: 1, name: 'Editar Carlos Vera' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))
  expect(await screen.findByText('Ficha de cliente')).toBeInTheDocument()
  expect(mocks.update.mock.calls[0]![0]).toMatchObject({
    id: 5,
    data: { name: 'Ana Pérez' },
  })
  expect(
    screen.getByText('Cliente «Ana Pérez» actualizado.'),
  ).toBeInTheDocument()
})

it('advierte antes de abandonar con cambios y, sin cambios, vuelve sin preguntar', async () => {
  const user = userEvent.setup()
  renderAt('/customers/new')
  await user.type(screen.getByLabelText('Nombre'), 'R')
  await user.click(screen.getByRole('link', { name: 'Volver a clientes' }))
  expect(
    await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(await screen.findByText('Lista de clientes')).toBeInTheDocument()
})

it('muestra la carga de la consulta del cliente', () => {
  mocks.detail = { data: undefined, isPending: true, isError: false }
  renderAt('/customers/5/edit')
  expect(screen.getByText('Cargando cliente…')).toBeInTheDocument()
})

it('explica cuando no se pudo cargar el cliente', () => {
  mocks.detail = { data: undefined, isPending: false, isError: true }
  renderAt('/customers/5/edit')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No se pudo cargar el cliente',
  )
})

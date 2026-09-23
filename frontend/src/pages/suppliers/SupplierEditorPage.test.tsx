import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  submit: { name: 'Repuestos SA' } as object,
  detail: { data: undefined as unknown, isPending: false, isError: false },
}))

vi.mock('@/features/suppliers/hooks', () => ({
  useSupplier: () => ({ ...mocks.detail, refetch: vi.fn() }),
  useSupplierMutations: () => ({
    create: { mutateAsync: mocks.create },
    update: { mutateAsync: mocks.update },
  }),
}))

// El formulario real tiene sus propias pruebas; aquí se aísla el comportamiento de la página.
vi.mock('@/features/suppliers/SupplierForm', () => ({
  SupplierForm: ({
    onSubmit,
    onDirtyChange,
    onCancel,
  }: {
    onSubmit: (data: object) => Promise<void>
    onDirtyChange: (dirty: boolean) => void
    onCancel: () => void
  }) => (
    <form aria-label="Formulario de proveedor">
      <label htmlFor="s-name">Nombre</label>
      <input id="s-name" onChange={() => onDirtyChange(true)} />
      <button onClick={() => void onSubmit(mocks.submit)} type="button">
        Guardar proveedor
      </button>
      <button onClick={onCancel} type="button">
        Cancelar
      </button>
    </form>
  ),
}))

import { SupplierEditorPage } from './SupplierEditorPage'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/suppliers', element: <p>Lista de proveedores</p> },
      { path: '/suppliers/new', element: <SupplierEditorPage /> },
      { path: '/suppliers/:id/edit', element: <SupplierEditorPage /> },
      { path: '/suppliers/:id', element: <p>Ficha de proveedor</p> },
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
  mocks.submit = { name: 'Repuestos SA' }
  mocks.detail = { data: undefined, isPending: false, isError: false }
})

it('crea el proveedor con clave de idempotencia, abre su ficha y lo confirma con un toast', async () => {
  mocks.create.mockResolvedValue({ id: 4, name: 'Repuestos SA', version: 1 })
  const user = userEvent.setup()
  const router = renderAt('/suppliers/new')
  expect(
    screen.getByRole('heading', { level: 1, name: 'Nuevo proveedor' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar proveedor' }))
  expect(await screen.findByText('Ficha de proveedor')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/suppliers/4')
  expect(mocks.create.mock.calls[0]![0].key).toMatch(/^[A-Za-z0-9._:-]{8,}$/)
  expect(
    screen.getByText('Proveedor «Repuestos SA» creado.'),
  ).toBeInTheDocument()
})

it('edita enviando la versión esperada y, sin cambios, vuelve a la ficha sin enviar', async () => {
  mocks.detail = {
    data: { id: 5, name: 'Lubricantes', version: 3 },
    isPending: false,
    isError: false,
  }
  mocks.update.mockResolvedValue({ id: 5, name: 'Repuestos SA', version: 4 })
  const user = userEvent.setup()
  renderAt('/suppliers/5/edit')
  expect(
    screen.getByRole('heading', { level: 1, name: 'Editar Lubricantes' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar proveedor' }))
  expect(await screen.findByText('Ficha de proveedor')).toBeInTheDocument()
  expect(mocks.update.mock.calls[0]![0]).toMatchObject({
    id: 5,
    data: { name: 'Repuestos SA', expected_version: 3 },
  })
  expect(
    screen.getByText('Proveedor «Repuestos SA» actualizado.'),
  ).toBeInTheDocument()
})

it('una edición sin campos cambiados vuelve a la ficha sin llamar al servidor', async () => {
  mocks.detail = {
    data: { id: 5, name: 'Lubricantes', version: 3 },
    isPending: false,
    isError: false,
  }
  mocks.submit = {}
  const user = userEvent.setup()
  renderAt('/suppliers/5/edit')
  await user.click(screen.getByRole('button', { name: 'Guardar proveedor' }))
  expect(await screen.findByText('Ficha de proveedor')).toBeInTheDocument()
  expect(mocks.update).not.toHaveBeenCalled()
})

it('advierte antes de abandonar con cambios y, sin cambios, vuelve sin preguntar', async () => {
  const user = userEvent.setup()
  renderAt('/suppliers/new')
  await user.type(screen.getByLabelText('Nombre'), 'R')
  await user.click(screen.getByRole('link', { name: 'Volver a proveedores' }))
  expect(
    await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(await screen.findByText('Lista de proveedores')).toBeInTheDocument()
})

it('muestra la carga de la consulta del proveedor', () => {
  mocks.detail = { data: undefined, isPending: true, isError: false }
  renderAt('/suppliers/5/edit')
  expect(screen.getByText('Cargando proveedor…')).toBeInTheDocument()
})

it('explica cuando no se pudo cargar el proveedor', () => {
  mocks.detail = { data: undefined, isPending: false, isError: true }
  renderAt('/suppliers/5/edit')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No se pudo cargar el proveedor',
  )
})

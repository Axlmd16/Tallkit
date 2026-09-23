import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  detail: { data: undefined as unknown, isPending: false, isError: false },
}))

vi.mock('@/features/products/hooks', () => ({
  useProduct: () => ({ ...mocks.detail, refetch: vi.fn() }),
  useProductMutations: () => ({
    create: { mutateAsync: mocks.create },
    update: { mutateAsync: mocks.update },
  }),
}))

// El formulario real tiene sus propias pruebas; aquí se aísla el comportamiento de la página.
vi.mock('@/features/products/ProductForm', () => ({
  ProductForm: ({
    onSubmit,
    onDirtyChange,
    onCancel,
  }: {
    onSubmit: (data: object) => Promise<void>
    onDirtyChange: (dirty: boolean) => void
    onCancel: () => void
  }) => (
    <form aria-label="Formulario de producto">
      <label htmlFor="p-name">Nombre</label>
      <input id="p-name" onChange={() => onDirtyChange(true)} />
      <button onClick={() => void onSubmit({ name: 'Filtro' })} type="button">
        Guardar producto
      </button>
      <button onClick={onCancel} type="button">
        Cancelar
      </button>
    </form>
  ),
}))

import { ProductEditorPage } from './ProductEditorPage'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/products', element: <p>Lista de productos</p> },
      { path: '/products/new', element: <ProductEditorPage /> },
      { path: '/products/:id/edit', element: <ProductEditorPage /> },
      { path: '/products/:id', element: <p>Ficha de producto</p> },
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
  mocks.detail = { data: undefined, isPending: false, isError: false }
})

it('crea el producto con clave de idempotencia, abre su ficha y lo confirma con un toast', async () => {
  mocks.create.mockResolvedValue({ id: 9, name: 'Filtro', version: 1 })
  const user = userEvent.setup()
  const router = renderAt('/products/new')
  expect(
    screen.getByRole('heading', { level: 1, name: 'Nuevo producto' }),
  ).toBeInTheDocument()

  await user.type(screen.getByLabelText('Nombre'), 'F')
  await user.click(screen.getByRole('button', { name: 'Guardar producto' }))

  expect(await screen.findByText('Ficha de producto')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/products/9')
  expect(mocks.create.mock.calls[0]![0].key).toMatch(/^[A-Za-z0-9._:-]{8,}$/)
  expect(screen.getByText('Producto «Filtro» creado.')).toBeInTheDocument()
})

it('edita enviando la versión esperada y vuelve a la ficha', async () => {
  mocks.detail = {
    data: { id: 5, name: 'Aceite', version: 3 },
    isPending: false,
    isError: false,
  }
  mocks.update.mockResolvedValue({ id: 5, name: 'Filtro', version: 4 })
  const user = userEvent.setup()
  renderAt('/products/5/edit')
  expect(
    screen.getByRole('heading', { level: 1, name: 'Editar Aceite' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar producto' }))
  expect(await screen.findByText('Ficha de producto')).toBeInTheDocument()
  expect(mocks.update.mock.calls[0]![0]).toMatchObject({
    id: 5,
    data: { name: 'Filtro', expected_version: 3 },
  })
})

it('advierte antes de abandonar con cambios sin guardar y permite seguir editando', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')
  await user.type(screen.getByLabelText('Nombre'), 'F')
  await user.click(screen.getByRole('link', { name: 'Volver a productos' }))

  expect(
    await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByLabelText('Nombre')).toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'Volver a productos' }))
  await user.click(
    await screen.findByRole('button', { name: 'Descartar cambios' }),
  )
  expect(await screen.findByText('Lista de productos')).toBeInTheDocument()
})

it('sin cambios vuelve a la lista sin preguntar', async () => {
  const user = userEvent.setup()
  renderAt('/products/new')
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(await screen.findByText('Lista de productos')).toBeInTheDocument()
})

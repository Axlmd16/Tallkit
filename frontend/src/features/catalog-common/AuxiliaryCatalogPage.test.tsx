import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  list: {} as Record<string, unknown>,
  create: vi.fn(),
  update: vi.fn(),
  setActive: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))

import {
  AuxiliaryCatalogPage,
  type AuxiliaryItem,
} from './AuxiliaryCatalogPage'

const item: AuxiliaryItem = {
  id: 1,
  name: 'Frenos',
  is_active: true,
  version: 1,
  created_at: '2026-09-20T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
}

function Page() {
  return (
    <AuxiliaryCatalogPage<AuxiliaryItem>
      deactivateText={(row) => `¿Desactivar «${row.name}»?`}
      description="Categorías de prueba."
      feminine
      fields={[
        { name: 'name', label: 'Nombre', maxLength: 20, required: true },
      ]}
      idPrefix="test"
      noun="categoría"
      nounPlural="categorías"
      title="Categorías"
      useDetail={() => ({ data: item, isPending: false, refetch: vi.fn() })}
      useList={() => mocks.list as never}
      useMutations={() => ({
        create: { mutateAsync: mocks.create },
        update: { mutateAsync: mocks.update },
        setActive: { mutateAsync: mocks.setActive },
      })}
    />
  )
}

const renderPage = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Page />
    </MemoryRouter>,
  )

beforeEach(() => {
  Object.values(mocks).forEach((value) => {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset()
  })
  mocks.permissions = ['productos.ver']
  mocks.list = {
    isPending: false,
    isError: false,
    data: { count: 1, page: 1, page_size: 20, total_pages: 1, results: [item] },
  }
})

it('muestra la lista sin acciones de gestión a quien solo consulta', () => {
  renderPage()
  expect(screen.getAllByText('Frenos').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /nueva categoría/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /desactivar/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
})

it.each([
  ['carga', { isPending: true, isError: false }, /cargando categorías/i],
  ['error', { isPending: false, isError: true }, /no fue posible consultar/i],
  [
    'vacío',
    {
      isPending: false,
      isError: false,
      data: { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] },
    },
    /no hay categorías/i,
  ],
])('presenta el estado de %s', (_name, list, text) => {
  mocks.list = list
  renderPage()
  expect(screen.getAllByText(text)[0]).toBeInTheDocument()
})

it('distingue «sin coincidencias» cuando hay filtros', () => {
  mocks.list = {
    isPending: false,
    isError: false,
    data: { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] },
  }
  renderPage('/?search=zzz')
  expect(screen.getByText('Sin coincidencias')).toBeInTheDocument()
})

it('crea con una clave y evita el doble envío', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  let resolve: (value: unknown) => void = () => undefined
  mocks.create.mockReturnValue(new Promise((r) => (resolve = r)))
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
  await user.type(screen.getByLabelText(/nombre/i), '  Aceites ')
  const submit = screen.getByRole('button', { name: /guardar categoría/i })
  await user.click(submit)
  await user.click(submit)

  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.create.mock.calls[0]![0].data).toEqual({ name: 'Aceites' })
  expect(mocks.create.mock.calls[0]![0].key).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  resolve({ ...item, name: 'Aceites' })
  expect(
    await screen.findByText(/categoría «aceites» creada/i),
  ).toBeInTheDocument()
})

it('valida obligatorios y longitud sin llamar al servidor', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
  await user.click(screen.getByRole('button', { name: /guardar categoría/i }))
  expect(await screen.findByText(/nombre es obligatorio/i)).toBeInTheDocument()
  expect(mocks.create).not.toHaveBeenCalled()
})

it('conserva la clave al reintentar tras un resultado incierto', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  mocks.create
    .mockRejectedValueOnce(new ProblemError('sin red', 0, 'network_error'))
    .mockResolvedValueOnce({ ...item, name: 'Aceites' })
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
  await user.type(screen.getByLabelText(/nombre/i), 'Aceites')
  await user.click(screen.getByRole('button', { name: /guardar categoría/i }))
  const retry = await screen.findByRole('button', { name: /reintentar envío/i })
  expect(screen.getByRole('alert')).toHaveTextContent(/sin duplicarla/i)
  await user.click(retry)

  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
  expect(mocks.create.mock.calls[1]![0].key).toBe(
    mocks.create.mock.calls[0]![0].key,
  )
})

it('usa una clave nueva si el usuario edita el borrador tras el fallo', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  mocks.create
    .mockRejectedValueOnce(new ProblemError('sin red', 0, 'network_error'))
    .mockResolvedValueOnce({ ...item })
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
  await user.type(screen.getByLabelText(/nombre/i), 'Aceites')
  await user.click(screen.getByRole('button', { name: /guardar categoría/i }))
  await screen.findByRole('button', { name: /reintentar envío/i })
  await user.type(screen.getByLabelText(/nombre/i), 's')
  await user.click(screen.getByRole('button', { name: /reintentar envío/i }))

  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
  expect(mocks.create.mock.calls[1]![0].key).not.toBe(
    mocks.create.mock.calls[0]![0].key,
  )
})

it('explica la baja rechazada y conserva el diálogo abierto', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  mocks.setActive.mockRejectedValue(
    new ProblemError(
      'La categoría tiene productos activos.',
      409,
      'category_has_active_products',
    ),
  )
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getAllByRole('button', { name: /desactivar/i })[0]!)
  const dialog = await screen.findByRole('dialog')
  await user.click(
    within(dialog).getByRole('button', { name: /confirmar desactivación/i }),
  )

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    /reclasifique o desactive/i,
  )
  expect(mocks.setActive.mock.calls[0]![0]).toMatchObject({
    id: 1,
    active: false,
    expectedVersion: 1,
  })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('muestra los errores por campo devueltos por el servidor', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  mocks.create.mockRejectedValue(
    new ProblemError('Nombre duplicado.', 409, 'duplicate_name', 'r', {
      name: ['Ya existe una categoría con ese nombre.'],
    }),
  )
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
  await user.type(screen.getByLabelText(/nombre/i), 'Frenos')
  await user.click(screen.getByRole('button', { name: /guardar categoría/i }))
  expect(
    await screen.findByText('Ya existe una categoría con ese nombre.'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/nombre/i)).toHaveValue('Frenos')
})

it('advierte de cambios sin guardar antes de cerrar el panel', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
  await user.type(screen.getByLabelText(/nombre/i), 'Borrador')
  await user.keyboard('{Escape}')
  expect(
    await screen.findByText(/hay cambios sin guardar/i),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/nombre/i)).toHaveValue('Borrador')
})

it('conserva filtros y página en la URL al buscar', async () => {
  const user = userEvent.setup()
  renderPage('/?page=3&is_active=all')
  await user.type(screen.getByLabelText(/buscar categoría/i), 'fre{Enter}')
  expect(screen.getByLabelText(/buscar categoría/i)).toHaveValue('fre')
  expect(screen.getByLabelText('Estado')).toHaveValue('all')
})

it('permite reintentar una consulta fallida conservando los filtros', async () => {
  const refetch = vi.fn()
  mocks.list = { isPending: false, isError: true, refetch }
  const user = userEvent.setup()
  renderPage('/?search=fre&is_active=all')
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(refetch).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText(/buscar categoría/i)).toHaveValue('fre')
  expect(screen.getByLabelText('Estado')).toHaveValue('all')
  expect(screen.queryByText(/operación exitosa/i)).toBeNull()
})

it('al cancelar la desactivación conserva el estado y devuelve el foco al disparador', async () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  const user = userEvent.setup()
  renderPage()
  const trigger = screen.getAllByRole('button', { name: /desactivar/i })[0]!
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(mocks.setActive).not.toHaveBeenCalled()
  await waitFor(() => expect(trigger).toHaveFocus())
})

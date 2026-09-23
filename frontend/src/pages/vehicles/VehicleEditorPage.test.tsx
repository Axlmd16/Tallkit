import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  submit: {} as object,
  detail: { data: undefined as unknown, isPending: false, isError: false },
}))

vi.mock('@/features/vehicles/hooks', () => ({
  useVehicle: () => ({ ...mocks.detail, refetch: vi.fn() }),
  useVehicleMutations: () => ({
    createVehicle: { mutateAsync: mocks.create },
    updateVehicle: { mutateAsync: mocks.update },
  }),
}))

// El formulario real tiene sus propias pruebas; aquí se aísla el comportamiento de la página.
vi.mock('@/features/vehicles/VehicleForm', () => ({
  VehicleForm: ({
    onSubmit,
    onDirtyChange,
    onCancel,
    defaultOwnerId,
    defaultOwnerName,
  }: {
    onSubmit: (data: object) => Promise<void>
    onDirtyChange: (dirty: boolean) => void
    onCancel: () => void
    defaultOwnerId?: number
    defaultOwnerName?: string
  }) => (
    <form aria-label="Formulario de vehículo">
      <p>
        Propietario sugerido: {defaultOwnerId ?? '—'} {defaultOwnerName ?? ''}
      </p>
      <label htmlFor="v-plate">Placa</label>
      <input id="v-plate" onChange={() => onDirtyChange(true)} />
      <button onClick={() => void onSubmit(mocks.submit)} type="button">
        Guardar vehículo
      </button>
      <button onClick={onCancel} type="button">
        Cancelar
      </button>
    </form>
  ),
}))

import { VehicleEditorPage } from './VehicleEditorPage'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/vehicles', element: <p>Lista de vehículos</p> },
      { path: '/vehicles/new', element: <VehicleEditorPage /> },
      { path: '/vehicles/:id/edit', element: <VehicleEditorPage /> },
      { path: '/vehicles/:id', element: <p>Ficha de vehículo</p> },
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
  mocks.submit = { plate: 'GBE-1234', owner_id: 3 }
  mocks.detail = { data: undefined, isPending: false, isError: false }
})

it('registra el vehículo con el propietario sugerido por la ficha del cliente y abre su ficha', async () => {
  mocks.create.mockResolvedValue({ id: 8, plate: 'GBE-1234', version: 1 })
  const user = userEvent.setup()
  const router = renderAt('/vehicles/new?owner_id=3&owner_name=Ana')
  expect(
    screen.getByRole('heading', { level: 1, name: 'Nuevo vehículo' }),
  ).toBeInTheDocument()
  expect(screen.getByText(/Propietario sugerido: 3 Ana/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar vehículo' }))
  expect(await screen.findByText('Ficha de vehículo')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/vehicles/8')
  expect(mocks.create).toHaveBeenCalledWith({ plate: 'GBE-1234', owner_id: 3 })
  expect(
    screen.getByText('Vehículo «GBE-1234» registrado.'),
  ).toBeInTheDocument()
})

it('edita sin enviar el identificador dentro de los datos', async () => {
  mocks.detail = {
    data: { id: 5, plate: 'PBA-7890', version: 2 },
    isPending: false,
    isError: false,
  }
  mocks.submit = { id: 5, model: 'Corolla', expected_version: 2 }
  mocks.update.mockResolvedValue({ id: 5, plate: 'PBA-7890', version: 3 })
  const user = userEvent.setup()
  renderAt('/vehicles/5/edit')
  expect(
    screen.getByRole('heading', { level: 1, name: 'Editar PBA-7890' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar vehículo' }))
  expect(await screen.findByText('Ficha de vehículo')).toBeInTheDocument()
  expect(mocks.update).toHaveBeenCalledWith({
    id: 5,
    data: { model: 'Corolla', expected_version: 2 },
  })
  expect(
    screen.getByText('Vehículo «PBA-7890» actualizado.'),
  ).toBeInTheDocument()
})

it('advierte antes de abandonar con cambios y, sin cambios, vuelve sin preguntar', async () => {
  const user = userEvent.setup()
  renderAt('/vehicles/new')
  await user.type(screen.getByLabelText('Placa'), 'G')
  await user.click(screen.getByRole('link', { name: 'Volver a vehículos' }))
  expect(
    await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(await screen.findByText('Lista de vehículos')).toBeInTheDocument()
})

it('muestra la carga de la consulta del vehículo', () => {
  mocks.detail = { data: undefined, isPending: true, isError: false }
  renderAt('/vehicles/5/edit')
  expect(screen.getByText('Cargando vehículo…')).toBeInTheDocument()
})

it('explica cuando no se pudo cargar el vehículo', () => {
  mocks.detail = { data: undefined, isPending: false, isError: true }
  renderAt('/vehicles/5/edit')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No se pudo cargar el vehículo',
  )
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  brands: {} as Record<string, unknown>,
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))

vi.mock('@/features/vehicle-brands/hooks', () => ({
  useVehicleBrands: () => mocks.brands,
  useVehicleBrandMutations: () => ({
    createBrand: { mutateAsync: mocks.create },
    updateBrand: { mutateAsync: mocks.update },
    activateBrand: { mutateAsync: mocks.activate },
    deactivateBrand: { mutateAsync: mocks.deactivate },
  }),
}))

import { VehicleBrandsPage } from './VehicleBrandsPage'

const sampleBrand = {
  id: 1,
  name: 'Toyota',
  is_active: true,
  version: 1,
  created_at: '2026-09-13T00:00:00Z',
  updated_at: '2026-09-13T00:00:00Z',
}

beforeEach(() => {
  vi.restoreAllMocks()
  Object.values(mocks).forEach((value) => {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset()
  })
  mocks.permissions = ['marcas_vehiculo.ver']
  mocks.brands = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [sampleBrand],
    },
  }
})

it('renders brands list and restricts management actions without permission', () => {
  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  expect(screen.getByRole('heading', { name: /marcas/i })).toBeInTheDocument()
  expect(screen.getAllByText('Toyota')[0]).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /nueva marca/i }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /editar/i }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /desactivar/i }),
  ).not.toBeInTheDocument()
})

it('allows creating and editing when user has marcas_vehiculo.gestionar', async () => {
  mocks.permissions = ['marcas_vehiculo.ver', 'marcas_vehiculo.gestionar']
  const user = userEvent.setup()

  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  const newBtn = screen.getByRole('button', { name: /nueva marca/i })
  expect(newBtn).toBeInTheDocument()
  await user.click(newBtn)

  const drawer = screen.getByRole('dialog', { name: /nueva marca/i })
  expect(drawer).toBeInTheDocument()

  await user.type(
    within(drawer).getByLabelText(/nombre de la marca/i),
    'Chevrolet',
  )
  await user.click(
    within(drawer).getByRole('button', { name: /guardar marca/i }),
  )

  expect(mocks.create).toHaveBeenCalledWith({ name: 'Chevrolet' })
  // Edit button present, but not deactivate
  expect(
    screen.getAllByRole('button', { name: /editar/i })[0],
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /desactivar/i }),
  ).not.toBeInTheDocument()
})

it('allows deactivation when user has marcas_vehiculo.desactivar', async () => {
  mocks.permissions = [
    'marcas_vehiculo.ver',
    'marcas_vehiculo.gestionar',
    'marcas_vehiculo.desactivar',
  ]
  const user = userEvent.setup()

  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  const deactBtn = screen.getAllByRole('button', { name: /desactivar/i })[0]!
  await user.click(deactBtn)

  const dialog = screen.getByRole('dialog', { name: /desactivar marca/i })
  expect(dialog).toBeInTheDocument()

  await user.click(
    within(dialog).getByRole('button', { name: /confirmar desactivación/i }),
  )
  expect(mocks.deactivate).toHaveBeenCalledWith({ id: 1, expectedVersion: 1 })
})

it('shows empty state when list has no records', () => {
  mocks.brands = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 0,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [],
    },
  }

  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  expect(screen.getByText(/no hay marcas registradas/i)).toBeInTheDocument()
})

it('shows loading state while brands are loading', () => {
  mocks.brands = { isPending: true, isError: false, isSuccess: false }

  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  expect(screen.getByText('Cargando catálogo de marcas...')).toBeInTheDocument()
})

it('shows error state when brands fail to load', () => {
  mocks.brands = { isPending: false, isError: true, isSuccess: false }

  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  expect(
    screen.getByText(/No fue posible consultar las marcas/i),
  ).toBeInTheDocument()
})

it('allows editing an existing brand via edit drawer', async () => {
  mocks.permissions = ['marcas_vehiculo.ver', 'marcas_vehiculo.gestionar']
  mocks.update.mockResolvedValue(sampleBrand)
  const user = userEvent.setup()

  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  const editButtons = screen.getAllByRole('button', { name: /editar/i })
  await user.click(editButtons[0]!)

  const drawer = screen.getByRole('dialog', { name: /editar marca/i })
  expect(drawer).toBeInTheDocument()

  await user.click(
    within(drawer).getByRole('button', { name: /guardar cambios/i }),
  )
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
})

it('allows administrator to activate an inactive brand', async () => {
  mocks.permissions = [
    'marcas_vehiculo.ver',
    'marcas_vehiculo.gestionar',
    'marcas_vehiculo.desactivar',
  ]
  mocks.brands = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [{ ...sampleBrand, is_active: false }],
    },
  }
  mocks.activate.mockResolvedValue({ ...sampleBrand, is_active: true })
  const user = userEvent.setup()

  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  const actBtn = screen.getAllByRole('button', { name: /activar/i })[0]!
  await user.click(actBtn)

  const dialog = screen.getByRole('dialog', { name: /activar marca/i })
  await user.click(
    within(dialog).getByRole('button', { name: /confirmar reactivación/i }),
  )
  expect(mocks.activate).toHaveBeenCalledWith({ id: 1, expectedVersion: 1 })
})

it('renders pagination controls when multiple pages exist', () => {
  mocks.brands = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 40,
      page: 1,
      page_size: 20,
      total_pages: 2,
      results: [sampleBrand],
    },
  }

  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/vehicle-brands']}>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )

  expect(
    screen.getByRole('navigation', { name: /paginación/i }),
  ).toBeInTheDocument()
})

function renderManager() {
  mocks.permissions = ['marcas_vehiculo.ver', 'marcas_vehiculo.gestionar']
  render(
    <ToastProvider>
      <MemoryRouter>
        <VehicleBrandsPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

it('crea la marca en un modal sobre la lista y lo confirma con un toast', async () => {
  mocks.create.mockResolvedValue({ ...sampleBrand, name: 'Great Wall' })
  const user = userEvent.setup()
  renderManager()
  await user.click(screen.getByRole('button', { name: /nueva marca/i }))
  const modal = screen.getByRole('dialog', { name: 'Nueva marca de vehículo' })
  await user.type(
    within(modal).getByLabelText('Nombre de la marca'),
    'Great Wall',
  )
  await user.click(within(modal).getByRole('button', { name: 'Guardar marca' }))

  expect(mocks.create).toHaveBeenCalledWith({ name: 'Great Wall' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByText('Marca «Great Wall» creada.')).toBeInTheDocument()
  expect(screen.queryByText('Operación exitosa')).toBeNull()
})

it('«Guardar y crear otra» deja el modal abierto con el campo vacío', async () => {
  mocks.create.mockResolvedValue(sampleBrand)
  const user = userEvent.setup()
  renderManager()
  await user.click(screen.getByRole('button', { name: /nueva marca/i }))
  const modal = screen.getByRole('dialog', { name: 'Nueva marca de vehículo' })
  const input = within(modal).getByLabelText('Nombre de la marca')
  await user.type(input, 'Kia')
  await user.click(
    within(modal).getByRole('button', { name: 'Guardar y crear otra' }),
  )
  expect(mocks.create).toHaveBeenCalledWith({ name: 'Kia' })
  expect(
    screen.getByRole('dialog', { name: 'Nueva marca de vehículo' }),
  ).toBeInTheDocument()
  expect(input).toHaveValue('')
})

it('exige el nombre junto al campo y no envía nada', async () => {
  const user = userEvent.setup()
  renderManager()
  await user.click(screen.getByRole('button', { name: /nueva marca/i }))
  const modal = screen.getByRole('dialog', { name: 'Nueva marca de vehículo' })
  await user.click(within(modal).getByRole('button', { name: 'Guardar marca' }))
  expect(
    within(modal).getByText('El nombre de la marca es obligatorio.'),
  ).toBeInTheDocument()
  expect(mocks.create).not.toHaveBeenCalled()
})

it('advierte antes de cerrar con cambios sin guardar', async () => {
  const user = userEvent.setup()
  renderManager()
  await user.click(screen.getByRole('button', { name: /nueva marca/i }))
  const modal = screen.getByRole('dialog', { name: 'Nueva marca de vehículo' })
  await user.type(within(modal).getByLabelText('Nombre de la marca'), 'Kia')
  await user.keyboard('{Escape}')
  expect(
    await screen.findByRole('button', { name: 'Seguir editando' }),
  ).toBeInTheDocument()
})

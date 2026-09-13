import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

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
    <MemoryRouter>
      <VehicleBrandsPage />
    </MemoryRouter>,
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
    <MemoryRouter>
      <VehicleBrandsPage />
    </MemoryRouter>,
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
    <MemoryRouter>
      <VehicleBrandsPage />
    </MemoryRouter>,
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
    <MemoryRouter>
      <VehicleBrandsPage />
    </MemoryRouter>,
  )

  expect(screen.getByText(/no hay marcas registradas/i)).toBeInTheDocument()
})

it('shows loading state while brands are loading', () => {
  mocks.brands = { isPending: true, isError: false, isSuccess: false }

  render(
    <MemoryRouter>
      <VehicleBrandsPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('status')).toBeInTheDocument()
})

it('shows error state when brands fail to load', () => {
  mocks.brands = { isPending: false, isError: true, isSuccess: false }

  render(
    <MemoryRouter>
      <VehicleBrandsPage />
    </MemoryRouter>,
  )

  expect(
    screen.getByText(/No fue posible cargar/i),
  ).toBeInTheDocument()
})

it('allows editing an existing brand via edit drawer', async () => {
  mocks.permissions = ['marcas_vehiculo.ver', 'marcas_vehiculo.gestionar']
  mocks.update.mockResolvedValue(sampleBrand)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <VehicleBrandsPage />
    </MemoryRouter>,
  )

  const editButtons = screen.getAllByRole('button', { name: /editar/i })
  await user.click(editButtons[0]!)

  const drawer = screen.getByRole('dialog', { name: /editar marca/i })
  expect(drawer).toBeInTheDocument()

  await user.click(
    within(drawer).getByRole('button', { name: /guardar marca/i }),
  )
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({ id: 1 }),
  )
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
    <MemoryRouter>
      <VehicleBrandsPage />
    </MemoryRouter>,
  )

  const actBtn = screen.getAllByRole('button', { name: /activar/i })[0]!
  await user.click(actBtn)

  const dialog = screen.getByRole('dialog', { name: /activar marca/i })
  await user.click(
    within(dialog).getByRole('button', { name: /confirmar activación/i }),
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
    <MemoryRouter initialEntries={['/vehicle-brands']}>
      <VehicleBrandsPage />
    </MemoryRouter>,
  )

  expect(
    screen.getByRole('navigation', { name: /paginación/i }),
  ).toBeInTheDocument()
})

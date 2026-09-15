import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  customer: {} as Record<string, unknown>,
  vehicles: {} as Record<string, unknown>,
  update: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  createVehicle: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))

vi.mock('@/features/customers/hooks', () => ({
  useCustomer: () => mocks.customer,
  useCustomers: () => ({
    data: { results: [sampleCustomer] },
    isLoading: false,
  }),
  useCustomerMutations: () => ({
    update: { mutateAsync: mocks.update },
    activate: { mutateAsync: mocks.activate },
    deactivate: { mutateAsync: mocks.deactivate },
  }),
}))

vi.mock('@/features/vehicles/hooks', () => ({
  useCustomerVehicles: () => mocks.vehicles,
  useVehicleMutations: () => ({
    createVehicle: { mutateAsync: mocks.createVehicle },
  }),
}))

vi.mock('@/features/vehicle-brands/hooks', () => ({
  useVehicleBrands: () => ({
    data: {
      results: [{ id: 1, name: 'Toyota', is_active: true }],
    },
    isLoading: false,
  }),
  useVehicleBrandMutations: () => ({
    createBrand: { mutateAsync: vi.fn() },
  }),
}))

import { CustomerDetailPage } from './CustomerDetailPage'

const sampleCustomer = {
  id: 1,
  person_type: 'NATURAL' as const,
  identification_type: 'CI' as const,
  identification: '0912345678',
  name: 'Carlos Vera',
  phone: '0991234567',
  email: 'carlos@example.com',
  address: 'Av. 9 de Octubre 100',
  is_active: true,
  version: 2,
  created_at: '2026-09-13T00:00:00Z',
  updated_at: '2026-09-13T00:00:00Z',
}

const sampleVehicle = {
  id: 10,
  plate: 'ABC-1234',
  model: 'Corolla',
  color: 'Blanco',
  year: 2022,
  vin: '1HGCR2F83HA000001',
  is_active: true,
  version: 1,
  created_at: '2026-09-13T00:00:00Z',
  updated_at: '2026-09-13T00:00:00Z',
  brand: { id: 1, name: 'Toyota', is_active: true },
  current_owner: {
    id: 1,
    name: 'Carlos Vera',
    identification: '0912345678',
    is_active: true,
  },
}

beforeEach(() => {
  vi.restoreAllMocks()
  Object.values(mocks).forEach((value) => {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset()
  })
  mocks.permissions = ['clientes.ver']
  mocks.customer = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: sampleCustomer,
  }
  mocks.vehicles = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      results: [sampleVehicle],
      count: 1,
      page: 1,
      total_pages: 1,
      page_size: 20,
    },
  }
})

it('renders customer details and associated vehicles with links', () => {
  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route element={<CustomerDetailPage />} path="/customers/:id" />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.getByRole('heading', { level: 1, name: 'Carlos Vera' }),
  ).toBeInTheDocument()
  expect(screen.getByText('0912345678')).toBeInTheDocument()
  expect(screen.getByText('0991234567')).toBeInTheDocument()
  expect(screen.getByText('carlos@example.com')).toBeInTheDocument()
  expect(screen.getByText('Av. 9 de Octubre 100')).toBeInTheDocument()
  expect(screen.getByText(/vehículos asociados/i)).toBeInTheDocument()
  expect(screen.getByText('ABC-1234')).toBeInTheDocument()
  expect(screen.getByText(/Toyota Corolla/)).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /volver a clientes/i }),
  ).toBeInTheDocument()
  const vehicleLink = screen.getByRole('link', { name: /ABC-1234/i })
  expect(vehicleLink).toHaveAttribute('href', '/vehicles/10')
})

it('handles customer not found', () => {
  mocks.customer = {
    isPending: false,
    isError: true,
    isSuccess: false,
    data: undefined,
  }

  render(
    <MemoryRouter initialEntries={['/customers/999']}>
      <Routes>
        <Route element={<CustomerDetailPage />} path="/customers/:id" />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.getByText(/no fue posible cargar la ficha del cliente/i),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /volver a clientes/i }),
  ).toBeInTheDocument()
})

it('allows authorized user to edit from customer detail page', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.gestionar']
  mocks.update.mockResolvedValue({ ...sampleCustomer, phone: '0997654321' })
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route element={<CustomerDetailPage />} path="/customers/:id" />
      </Routes>
    </MemoryRouter>,
  )

  const editBtn = screen.getByRole('button', { name: /editar cliente/i })
  await user.click(editBtn)

  const drawer = screen.getByRole('dialog', { name: /editar cliente/i })
  expect(drawer).toBeInTheDocument()

  const phoneInput = within(drawer).getByLabelText(/teléfono/i)
  await user.clear(phoneInput)
  await user.type(phoneInput, '0997654321')

  await user.click(
    within(drawer).getByRole('button', { name: /guardar cliente/i }),
  )
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 1,
      data: expect.objectContaining({
        phone: '0997654321',
        expected_version: 2,
      }),
    }),
  )
})

it('displays empty state when customer has no associated vehicles', () => {
  mocks.vehicles = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      results: [],
      count: 0,
      page: 1,
      total_pages: 1,
      page_size: 20,
    },
  }

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route element={<CustomerDetailPage />} path="/customers/:id" />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.getByText('El cliente no tiene vehículos asociados actualmente.'),
  ).toBeInTheDocument()
})

it('allows authorized user to open vehicle registration drawer and register vehicle with customer preselected', async () => {
  mocks.permissions = ['clientes.ver', 'vehiculos.gestionar']
  mocks.createVehicle.mockResolvedValue({
    ...sampleVehicle,
    id: 11,
    plate: 'PBC-9999',
    model: 'Yaris',
  })
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route element={<CustomerDetailPage />} path="/customers/:id" />
      </Routes>
    </MemoryRouter>,
  )

  const registerBtn = screen.getByRole('button', {
    name: /registrar vehículo/i,
  })
  await user.click(registerBtn)

  const drawer = screen.getByRole('dialog', {
    name: /registrar vehículo/i,
  })
  expect(drawer).toBeInTheDocument()
  expect(within(drawer).getByText('Carlos Vera')).toBeInTheDocument()

  await user.selectOptions(
    within(drawer).getByLabelText('Marca de vehículo'),
    '1',
  )
  await user.type(within(drawer).getByLabelText('Placa'), 'PBC-9999')
  await user.type(within(drawer).getByLabelText('Modelo'), 'Yaris')

  await user.click(
    within(drawer).getByRole('button', { name: 'Guardar vehículo' }),
  )

  expect(mocks.createVehicle).toHaveBeenCalledWith(
    expect.objectContaining({
      owner_id: 1,
      brand_id: 1,
      plate: 'PBC-9999',
      model: 'Yaris',
    }),
  )
})

it('does not display vehicle registration button when user lacks vehiculos.gestionar', () => {
  mocks.permissions = ['clientes.ver']

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route element={<CustomerDetailPage />} path="/customers/:id" />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.queryByRole('button', { name: /registrar vehículo/i }),
  ).not.toBeInTheDocument()
})

it('allows administrator to deactivate customer via confirmation dialog', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.desactivar']
  mocks.deactivate.mockResolvedValue({ ...sampleCustomer, is_active: false })
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route element={<CustomerDetailPage />} path="/customers/:id" />
      </Routes>
    </MemoryRouter>,
  )

  const deactBtn = screen.getByRole('button', { name: /^desactivar$/i })
  expect(deactBtn).toBeInTheDocument()

  await user.click(deactBtn)

  const dialog = screen.getByRole('dialog', { name: /desactivar cliente/i })
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByText(/carlos vera/i)).toBeInTheDocument()

  await user.click(
    within(dialog).getByRole('button', { name: /confirmar desactivación/i }),
  )

  expect(mocks.deactivate).toHaveBeenCalledWith({
    id: 1,
    expectedVersion: 2,
  })
})

it('displays version conflict error when deactivation fails with stale record', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.desactivar']
  mocks.deactivate.mockRejectedValue(
    new ProblemError('Conflicto.', 409, 'stale_record'),
  )
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route element={<CustomerDetailPage />} path="/customers/:id" />
      </Routes>
    </MemoryRouter>,
  )

  await user.click(screen.getByRole('button', { name: /^desactivar$/i }))
  const dialog = screen.getByRole('dialog', { name: /desactivar cliente/i })
  await user.click(
    within(dialog).getByRole('button', { name: /confirmar desactivación/i }),
  )

  expect(
    await screen.findByText(
      'La ficha del cliente fue modificada por otro usuario. Recargue la página para ver la versión más reciente.',
    ),
  ).toBeInTheDocument()
})

it('shows loading state while customer is fetching', () => {
  mocks.customer = { isPending: true, isError: false, isSuccess: false }
  mocks.permissions = ['clientes.ver']

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByRole('status')).toBeInTheDocument()
})

it('shows error state when customer fails to load', () => {
  mocks.customer = { isPending: false, isError: true, isSuccess: false }
  mocks.permissions = ['clientes.ver']

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.getByText(/No fue posible cargar la ficha del cliente/i),
  ).toBeInTheDocument()
})

it('allows authorized user to open edit drawer from customer detail', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.gestionar']
  mocks.update.mockResolvedValue(sampleCustomer)
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

  const editBtn = screen.getByRole('button', { name: /^editar$/i })
  await user.click(editBtn)

  const drawer = screen.getByRole('dialog', { name: /editar cliente/i })
  expect(drawer).toBeInTheDocument()

  await user.click(
    within(drawer).getByRole('button', { name: /guardar cliente/i }),
  )
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
})

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
  commercialSales: [] as unknown[],
  commercialDebt: [] as unknown[],
  artisanDebt: [] as unknown[],
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

vi.mock('@/features/customers/accounts', () => ({
  useCustomerAccountSummary: () => ({
    data: {
      visits: { count_year: 4, last_on: '2026-11-15' },
      commercial: {
        spent_year: '40.00',
        documents_year: 1,
        last_on: null,
        balance: '18.00',
      },
      artisan: {
        spent_year: '60.00',
        documents_year: 1,
        last_on: null,
        balance: '0.00',
      },
    },
  }),
}))
vi.mock('@/features/maintenance/NewMaintenanceDialog', () => ({
  NewMaintenanceDialog: () => (
    <div role="dialog" aria-label="Nuevo mantenimiento" />
  ),
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useBusinessName: (scope: string) =>
    scope === 'commercial' ? 'Repuestos' : 'Servicios',
  useIssuerBrand: () => ({
    logoUrl: null,
    legalName: undefined,
    displayName: undefined,
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

vi.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceOrders: () => ({
    isPending: false,
    isError: false,
    data: {
      count: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
      results: [
        {
          id: 7,
          number: 'ART-OT-000007',
          state: 'REGISTERED',
          opened_on: '2026-09-20',
          odometer_km: 1,
          customer: { id: 1, name: 'x', identification: '1', is_active: true },
          vehicle: {
            id: 4,
            plate: 'ABC-1234',
            brand: 'T',
            model: 'H',
            is_active: true,
          },
          services_total: '0.00',
          service_summary: { names: [], line_count: 0 },
        },
      ],
    },
  }),
}))

vi.mock('@/features/sales/hooks', () => ({
  useSales: (filters: unknown) => {
    mocks.commercialSales.push(filters)
    return {
      isPending: false,
      isError: false,
      data: {
        results: [
          {
            id: 31,
            internal_number: 'COM-VEN-000031',
            sale_date: '2026-10-01',
            grand_total: '40.00',
          },
        ],
      },
    }
  },
  useReceivables: (filters: unknown) => {
    mocks.commercialDebt.push(filters)
    return {
      isPending: false,
      isError: false,
      data: {
        receivable_total: '300.00',
        results: [
          {
            id: 31,
            internal_number: 'COM-VEN-000031',
            money: { balance: '300.00' },
          },
        ],
      },
    }
  },
}))
vi.mock('@/features/maintenance/billingHooks', () => ({
  useArtisanReceivables: (filters: unknown) => {
    mocks.artisanDebt.push(filters)
    return {
      isPending: false,
      isError: false,
      data: {
        totals: { balance: '120.00' },
        results: [
          { id: 9, internal_number: 'ART-SER-000009', balance: '120.00' },
        ],
      },
    }
  },
}))

import { CustomerDetailPage } from './CustomerDetailPage'
import { ToastProvider } from '@/shared/ui'

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
  mocks.commercialSales.length = 0
  mocks.commercialDebt.length = 0
  mocks.artisanDebt.length = 0
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

it('renders customer details and associated vehicles with links', async () => {
  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
          path="/customers/:id"
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.getByRole('heading', { level: 1, name: 'Carlos Vera' }),
  ).toBeInTheDocument()
  // Los datos de contacto van en la cabecera y el detalle completo, en la pestaña «Datos».
  expect(
    screen.getByText(/0912345678 · 0991234567 · carlos@example.com/),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: 'Datos' }))
  expect(screen.getByText('0912345678')).toBeInTheDocument()
  expect(screen.getByText('0991234567')).toBeInTheDocument()
  expect(screen.getByText('carlos@example.com')).toBeInTheDocument()
  expect(screen.getByText('Av. 9 de Octubre 100')).toBeInTheDocument()
  // Dato técnico interno: la versión sigue viajando al editar, pero no se muestra.
  expect(screen.queryByText(/versión de registro/i)).toBeNull()
  await userEvent.click(screen.getByRole('tab', { name: 'Vehículos' }))
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
        <Route
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
          path="/customers/:id"
        />
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

it('takes an authorized user from the detail to the edit page', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.gestionar']
  mocks.update.mockResolvedValue({ ...sampleCustomer, phone: '0997654321' })
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
          path="/customers/:id"
        />
        <Route
          element={<div>Editor de cliente</div>}
          path="/customers/:id/edit"
        />
      </Routes>
    </MemoryRouter>,
  )

  const editBtn = screen.getByRole('button', { name: /editar cliente/i })
  await user.click(editBtn)

  expect(screen.getByText('Editor de cliente')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
    <MemoryRouter initialEntries={['/customers/1?tab=vehiculos']}>
      <Routes>
        <Route
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
          path="/customers/:id"
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.getByText('El cliente no tiene vehículos asociados actualmente.'),
  ).toBeInTheDocument()
})

it('takes an authorized user to vehicle registration with the customer preselected', async () => {
  mocks.permissions = ['clientes.ver', 'vehiculos.gestionar']
  mocks.createVehicle.mockResolvedValue({
    ...sampleVehicle,
    id: 11,
    plate: 'PBC-9999',
    model: 'Yaris',
  })
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/customers/1?tab=vehiculos']}>
      <Routes>
        <Route
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
          path="/customers/:id"
        />
        <Route element={<div>Editor de vehículo</div>} path="/vehicles/new" />
      </Routes>
    </MemoryRouter>,
  )

  const registerBtn = screen.getByRole('button', {
    name: /registrar vehículo/i,
  })
  await user.click(registerBtn)

  expect(screen.getByText('Editor de vehículo')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('does not display vehicle registration button when user lacks vehiculos.gestionar', () => {
  mocks.permissions = ['clientes.ver']

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
          path="/customers/:id"
        />
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
        <Route
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
          path="/customers/:id"
        />
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
        <Route
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
          path="/customers/:id"
        />
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
        <Route
          path="/customers/:id"
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
    'Cargando ficha del cliente…',
  )
})

it('shows error state when customer fails to load', () => {
  mocks.customer = { isPending: false, isError: true, isSuccess: false }
  mocks.permissions = ['clientes.ver']

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route
          path="/customers/:id"
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.getByText(/No fue posible cargar la ficha del cliente/i),
  ).toBeInTheDocument()
})

it('navigates to edit from the customer detail actions', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.gestionar']
  mocks.update.mockResolvedValue(sampleCustomer)
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/customers/1']}>
      <Routes>
        <Route
          path="/customers/:id"
          element={
            <ToastProvider>
              <CustomerDetailPage />
            </ToastProvider>
          }
        />
        <Route
          path="/customers/:id/edit"
          element={<div>Editor de cliente</div>}
        />
      </Routes>
    </MemoryRouter>,
  )

  const editBtn = screen.getByRole('button', { name: /^editar cliente$/i })
  await user.click(editBtn)

  expect(screen.getByText('Editor de cliente')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('muestra el historial de mantenimientos solo con su permiso', () => {
  const view = render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/customers/1']}>
        <Routes>
          <Route element={<CustomerDetailPage />} path="/customers/:id" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
  expect(
    screen.queryByRole('heading', { name: 'Historial de mantenimientos' }),
  ).not.toBeInTheDocument()
  view.unmount()
  mocks.permissions = ['clientes.ver', 'mantenimientos.ver']
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/customers/1?tab=compras']}>
        <Routes>
          <Route element={<CustomerDetailPage />} path="/customers/:id" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
  expect(
    screen.getByRole('heading', { name: 'Historial de mantenimientos' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'ART-OT-000007' })).toHaveAttribute(
    'href',
    '/maintenance/7',
  )
})

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<CustomerDetailPage />} path="/customers/:id" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

it('la deuda se muestra por negocio, cada uno con su total, y nunca se suma', () => {
  mocks.permissions = [
    'clientes.ver',
    'pagos_comerciales.ver',
    'pagos_artesanales.ver',
  ]
  renderAt('/customers/1?tab=deuda')

  const blocks = screen.getAllByRole('region')
  expect(blocks).toHaveLength(2)
  expect(within(blocks[0]!).getAllByText('USD 300.00').length).toBeGreaterThan(
    0,
  )
  expect(within(blocks[1]!).getAllByText('USD 120.00').length).toBeGreaterThan(
    0,
  )
  expect(screen.queryByText('USD 420.00')).toBeNull()
  expect(mocks.commercialDebt.at(-1)).toMatchObject({ customerId: 1 })
  expect(mocks.artisanDebt.at(-1)).toMatchObject({ customerId: 1 })
})

it('con permiso de un solo negocio no se ve ni se pide la deuda del otro', () => {
  mocks.permissions = ['clientes.ver', 'pagos_artesanales.ver']
  renderAt('/customers/1?tab=deuda')

  expect(screen.getAllByRole('region')).toHaveLength(1)
  expect(screen.getAllByText('USD 120.00').length).toBeGreaterThan(0)
  expect(screen.queryByText('USD 300.00')).toBeNull()
  expect(mocks.commercialDebt).toHaveLength(0)
  expect(mocks.artisanDebt.length).toBeGreaterThan(0)
})

it('sin permisos de compras ni de cuentas no aparecen esas pestañas', () => {
  mocks.permissions = ['clientes.ver']
  renderAt('/customers/1?tab=deuda')

  expect(screen.queryByRole('tab', { name: 'Historial' })).toBeNull()
  expect(screen.queryByRole('tab', { name: 'Deuda' })).toBeNull()
  expect(screen.getByRole('tab', { name: 'Vehículos' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(mocks.commercialDebt).toHaveLength(0)
  expect(mocks.artisanDebt).toHaveLength(0)
})

it('las compras muestran las ventas del cliente solo con permiso de ventas', () => {
  mocks.permissions = ['clientes.ver', 'ventas.ver']
  renderAt('/customers/1?tab=compras')

  expect(screen.getByRole('link', { name: 'COM-VEN-000031' })).toHaveAttribute(
    'href',
    '/sales/31',
  )
  expect(
    screen.queryByRole('heading', { name: 'Historial de mantenimientos' }),
  ).toBeNull()
  expect(mocks.commercialSales.at(-1)).toMatchObject({ customerId: 1 })
})

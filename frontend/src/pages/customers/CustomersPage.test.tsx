import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  customers: {} as Record<string, unknown>,
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))

vi.mock('@/features/customers/hooks', () => ({
  useCustomers: () => mocks.customers,
  useCustomerMutations: () => ({
    create: { mutateAsync: mocks.create },
    update: { mutateAsync: mocks.update },
    activate: { mutateAsync: mocks.activate },
    deactivate: { mutateAsync: mocks.deactivate },
  }),
}))

import { CustomersPage } from './CustomersPage'

const sampleCustomer = {
  id: 1,
  person_type: 'NATURAL' as const,
  identification_type: 'CI' as const,
  identification: '0912345678',
  name: 'Carlos Vera',
  phone: '0991234567',
  email: 'carlos@example.com',
  address: 'Av. 9 de Octubre',
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
  mocks.permissions = ['clientes.ver']
  mocks.customers = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [sampleCustomer],
    },
  }
})

it('renders customer list and restricts management actions without permission', () => {
  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  expect(screen.getAllByText('Carlos Vera')).not.toHaveLength(0)
  expect(screen.getAllByText('0912345678')).not.toHaveLength(0)
  expect(screen.getAllByText('0991234567')).not.toHaveLength(0)
  expect(screen.getAllByText('carlos@example.com')).not.toHaveLength(0)
  expect(screen.getAllByLabelText('Categoría: Cédula')).not.toHaveLength(0)
  expect(screen.getAllByRole('img', { name: 'Carlos Vera' })).not.toHaveLength(
    0,
  )
  expect(document.querySelector('.customers-page')).toHaveClass('list-page')
  expect(screen.queryAllByRole('link', { name: /ver ficha$/i })).toHaveLength(0)

  // With only clientes.ver, creation and edition are hidden
  expect(
    screen.queryByRole('button', { name: /nuevo cliente/i }),
  ).not.toBeInTheDocument()
  expect(screen.queryAllByRole('button', { name: /^editar$/i })).toHaveLength(0)
  expect(
    screen.queryAllByRole('button', { name: /^desactivar$/i }),
  ).toHaveLength(0)
})

it('shows an explicit muted label when a customer has no email', () => {
  mocks.customers = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [{ ...sampleCustomer, email: '' }],
    },
  }

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  expect(screen.getAllByText('Sin correo electrónico')).not.toHaveLength(0)
  expect(screen.getAllByText('Sin correo electrónico')[0]).toHaveClass('italic')
})

it('identifies RUC customers with the reusable category badge', () => {
  mocks.customers = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [
        {
          ...sampleCustomer,
          identification: '0999999999001',
          identification_type: 'RUC',
        },
      ],
    },
  }

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  expect(screen.getAllByLabelText('Categoría: RUC')).not.toHaveLength(0)
})

it('opens an overlaid customer preview when selecting a row', async () => {
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  await user.click(screen.getAllByText('Carlos Vera')[0]!)

  const preview = screen.getByRole('dialog', { name: 'Detalle del cliente' })
  expect(preview).toBeInTheDocument()
  expect(
    within(preview).getByRole('heading', { name: 'Carlos Vera' }),
  ).toBeInTheDocument()
  expect(
    within(preview).getByText('Información de contacto'),
  ).toBeInTheDocument()
  expect(within(preview).getByText('Correo electrónico')).toBeInTheDocument()
  expect(within(preview).getByText('Teléfono')).toBeInTheDocument()
  expect(within(preview).getByText('Dirección')).toBeInTheDocument()
  expect(within(preview).getByText('carlos@example.com')).toBeInTheDocument()
})

it('renders an empty state when the catalog has no customers', () => {
  mocks.customers = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] },
  }

  render(
    <MemoryRouter initialEntries={['/customers']}>
      <CustomersPage />
    </MemoryRouter>,
  )

  expect(
    screen.getByText(/aún no se han registrado clientes en el sistema/i),
  ).toBeInTheDocument()
})

it('renders an empty state when filters yield no matches', () => {
  mocks.customers = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] },
  }

  render(
    <MemoryRouter initialEntries={['/customers?search=inexistente']}>
      <CustomersPage />
    </MemoryRouter>,
  )

  expect(
    screen.getByText(
      /no hay clientes que coincidan con los filtros aplicados/i,
    ),
  ).toBeInTheDocument()
})

it('allows authorized user to open new customer drawer and save', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.gestionar']
  mocks.create.mockResolvedValue(sampleCustomer)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  const newButton = screen.getByRole('button', { name: /nuevo cliente/i })
  await user.click(newButton)

  const drawer = screen.getByRole('dialog', { name: /nuevo cliente/i })
  expect(drawer).toBeInTheDocument()
  expect(drawer).toHaveClass('customer-drawer')

  await user.type(
    within(drawer).getByLabelText(/nombres y apellidos/i),
    'María López',
  )
  await user.type(
    within(drawer).getByLabelText(/número de identificación/i),
    '0922222222',
  )
  await user.type(within(drawer).getByLabelText(/teléfono/i), '0988888888')

  await user.click(
    within(drawer).getByRole('button', { name: /guardar cliente/i }),
  )
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'María López',
      identification: '0922222222',
      phone: '0988888888',
    }),
  )
})

it('allows administrator to deactivate and reactivate customer via dialog', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.desactivar']
  mocks.deactivate.mockResolvedValue({ ...sampleCustomer, is_active: false })
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  const deactBtn = screen.getAllByRole('button', { name: /^desactivar$/i })[0]!
  await user.click(deactBtn)

  const dialog = screen.getByRole('dialog', { name: /desactivar cliente/i })
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByText(/carlos vera/i)).toBeInTheDocument()

  await user.click(
    within(dialog).getByRole('button', { name: /confirmar desactivación/i }),
  )
  expect(mocks.deactivate).toHaveBeenCalledWith({
    id: 1,
    expectedVersion: 1,
  })
})

it('shows loading state while data is loading', () => {
  mocks.customers = { isPending: true, isError: false, isSuccess: false }

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('status')).toBeInTheDocument()
})

it('shows error state on fetch failure', () => {
  mocks.customers = { isPending: false, isError: true, isSuccess: false }

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  expect(
    screen.getByText(/No fue posible cargar el listado de clientes/i),
  ).toBeInTheDocument()
})

it('allows editing an existing customer via edit drawer', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.gestionar']
  mocks.update.mockResolvedValue(sampleCustomer)
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  const editButtons = screen.getAllByRole('button', { name: /^editar$/i })
  await user.click(editButtons[0]!)

  const drawer = screen.getByRole('dialog', { name: /editar cliente/i })
  expect(drawer).toBeInTheDocument()

  await user.click(
    within(drawer).getByRole('button', { name: /guardar cliente/i }),
  )
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
})

it('allows administrator to activate an inactive customer', async () => {
  mocks.permissions = ['clientes.ver', 'clientes.desactivar']
  mocks.customers = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [{ ...sampleCustomer, is_active: false }],
    },
  }
  mocks.activate.mockResolvedValue({ ...sampleCustomer, is_active: true })
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>,
  )

  const actBtn = screen.getAllByRole('button', { name: /^activar$/i })[0]!
  await user.click(actBtn)

  const dialog = screen.getByRole('dialog', { name: /activar cliente/i })
  await user.click(
    within(dialog).getByRole('button', { name: /confirmar activación/i }),
  )
  expect(mocks.activate).toHaveBeenCalledWith({ id: 1, expectedVersion: 1 })
})

it('renders pagination controls when more than one page exists', () => {
  mocks.customers = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      count: 40,
      page: 1,
      page_size: 20,
      total_pages: 2,
      results: [sampleCustomer],
    },
  }

  render(
    <MemoryRouter initialEntries={['/customers']}>
      <CustomersPage />
    </MemoryRouter>,
  )

  expect(
    screen.getByRole('navigation', { name: /paginación/i }),
  ).toBeInTheDocument()
})

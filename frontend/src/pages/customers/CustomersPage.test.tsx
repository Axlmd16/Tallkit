import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  customers: {} as Record<string, unknown>,
  debtors: {} as Record<string, unknown>,
  args: [] as unknown[],
  debtorsEnabled: [] as boolean[],
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/customers/hooks', () => ({
  useCustomers: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.customers
  },
}))
vi.mock('@/features/customers/accounts', () => ({
  useCustomerDebtors: (enabled: boolean) => {
    mocks.debtorsEnabled.push(enabled)
    return mocks.debtors
  },
}))
vi.mock('@/features/customers/CustomerPreview', () => ({
  CustomerPreview: ({ customerId }: { customerId: number }) => (
    <p>Vista del cliente {customerId}</p>
  ),
}))
vi.mock('@/features/maintenance/NewMaintenanceDialog', () => ({
  NewMaintenanceDialog: () => null,
}))
vi.mock('@/features/customers/BusinessAmounts', () => ({
  owed: (value: string | null | undefined) =>
    value != null && Number(value) > 0 ? value : null,
  BusinessAmounts: ({
    artisan,
    commercial,
  }: {
    artisan: string | null
    commercial: string | null
  }) => (
    <span>
      {artisan && `Taller ${artisan}`} {commercial && `Repuestos ${commercial}`}
    </span>
  ),
}))

import { CustomersPage, groupLetter } from './CustomersPage'

const customer = (id: number, name: string, extra = {}) => ({
  id,
  person_type: 'NATURAL' as const,
  identification_type: 'CI' as const,
  identification: `09123456${id}`,
  name,
  phone: '0991234567',
  email: null,
  address: null,
  is_active: true,
  version: 1,
  created_at: '2026-09-13T00:00:00Z',
  updated_at: '2026-09-13T00:00:00Z',
  ...extra,
})

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderPage(path = '/customers') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <>
              <CustomersPage />
              <Where />
            </>
          }
          path="/customers"
        />
        <Route element={<Where />} path="/customers/new" />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.args.length = 0
  mocks.debtorsEnabled.length = 0
  mocks.permissions = [
    'clientes.ver',
    'clientes.gestionar',
    'pagos_comerciales.ver',
    'pagos_artesanales.ver',
  ]
  mocks.customers = {
    isPending: false,
    isError: false,
    data: {
      count: 3,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [
        customer(1, 'Álvaro Vera'),
        customer(2, 'Ana Torres'),
        customer(3, 'Carlos Mendoza'),
      ],
    },
  }
  mocks.debtors = {
    data: {
      visible: { commercial: true, artisan: true },
      items: [
        {
          customer_id: 3,
          name: 'Carlos Mendoza',
          identification: '091234563',
          person_type: 'NATURAL',
          commercial: '18.00',
          artisan: '45.00',
        },
        {
          customer_id: 2,
          name: 'Ana Torres',
          identification: '091234562',
          person_type: 'NATURAL',
          commercial: '0.00',
          artisan: null,
        },
      ],
    },
  }
})

it('agrupa por letra sin tilde y deja lo demás en «#»', () => {
  expect(groupLetter('Álvaro')).toBe('A')
  expect(groupLetter('  ñandú')).toBe('Ñ')
  expect(groupLetter('9 de Octubre S.A.')).toBe('#')
})

it('lista los clientes por letra y abre el primero en el detalle', () => {
  renderPage()
  const list = screen.getByRole('region', { name: 'Lista de clientes' })
  expect(within(list).getAllByTestId('master-detail-group')).toHaveLength(2)
  expect(within(list).getByText('Carlos Mendoza')).toBeInTheDocument()
  expect(screen.getByText('Vista del cliente 1')).toBeInTheDocument()
})

it('muestra la deuda de cada negocio por separado y nunca la suma', () => {
  renderPage()
  const list = screen.getByRole('region', { name: 'Lista de clientes' })
  expect(within(list).getByText(/Taller 45\.00/)).toBeInTheDocument()
  expect(within(list).getByText(/Repuestos 18\.00/)).toBeInTheDocument()
  expect(list.textContent).not.toMatch(/63\.00/)
  // Un saldo en cero no es deuda.
  expect(within(list).queryByText(/Repuestos 0\.00/)).toBeNull()
})

it('«Con deuda» muestra solo a quienes deben y cuenta solo saldos mayores que cero', async () => {
  const user = userEvent.setup()
  renderPage('/customers?segment=debt')
  const group = screen.getByRole('radiogroup', { name: 'Filtrar clientes' })
  expect(group).toHaveTextContent('Con deuda1')
  const list = screen.getByRole('region', { name: 'Lista de clientes' })
  expect(within(list).getByText('Carlos Mendoza')).toBeInTheDocument()
  expect(within(list).queryByText('Ana Torres')).toBeNull()

  await user.click(screen.getByRole('radio', { name: /Todos/ }))
  expect(screen.getByTestId('where')).not.toHaveTextContent('segment=debt')
})

it('«Empresas» pide al servidor solo personas jurídicas', () => {
  renderPage('/customers?segment=companies')
  expect(mocks.args.at(-1)).toMatchObject({ personType: 'JURIDICA' })
})

it('sin permiso de cobros no pide la deuda ni ofrece «Con deuda»', () => {
  mocks.permissions = ['clientes.ver']
  mocks.debtors = {}
  renderPage()
  expect(mocks.debtorsEnabled.at(-1)).toBe(false)
  expect(screen.queryByRole('radio', { name: /Con deuda/ })).toBeNull()
})

it('elegir un cliente lo deja en la dirección', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: /Carlos Mendoza/ }))
  expect(screen.getByTestId('where')).toHaveTextContent('ficha=3')
  expect(screen.getByText('Vista del cliente 3')).toBeInTheDocument()
})

it('ofrece «Nuevo cliente» solo con permiso de gestión', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: /Nuevo cliente/ }))
  expect(screen.getByTestId('where')).toHaveTextContent('/customers/new')
})

it('sin permiso de gestión no ofrece crear', () => {
  mocks.permissions = ['clientes.ver']
  renderPage()
  expect(screen.queryByRole('button', { name: /Nuevo cliente/ })).toBeNull()
})

it('explica cuando no hay clientes y cuando la búsqueda no encuentra', () => {
  mocks.customers = {
    isPending: false,
    isError: false,
    data: { count: 0, page: 1, page_size: 20, total_pages: 1, results: [] },
  }
  const { unmount } = renderPage()
  expect(screen.getByText('No hay clientes registrados')).toBeInTheDocument()
  unmount()
  renderPage('/customers?search=zzz')
  expect(screen.getByText(/No hay clientes que coincidan/)).toBeInTheDocument()
})

it('muestra la carga y el error de la lista', () => {
  mocks.customers = { isPending: true, isError: false }
  const { unmount } = renderPage()
  expect(screen.getByText(/Cargando clientes/)).toBeInTheDocument()
  unmount()
  mocks.customers = { isPending: false, isError: true }
  renderPage()
  expect(
    screen.getByText(/No fue posible cargar el listado de clientes/),
  ).toBeInTheDocument()
})

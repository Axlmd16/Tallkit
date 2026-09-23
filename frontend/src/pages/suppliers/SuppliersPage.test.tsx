import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  list: {} as Record<string, unknown>,
  args: [] as unknown[],
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/suppliers/hooks', () => ({
  useSuppliers: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.list
  },
  useSupplier: () => ({ data: undefined, refetch: vi.fn() }),
  useSupplierMutations: () => ({
    create: { mutateAsync: vi.fn() },
    update: { mutateAsync: vi.fn() },
    setActive: { mutateAsync: vi.fn() },
  }),
  useSupplierNameMatches: () => ({ data: undefined }),
}))

import { SuppliersPage } from './SuppliersPage'
import { ToastProvider } from '@/shared/ui'

const supplier = {
  id: 1,
  name: 'Juan Pérez',
  identification_type: null,
  identification: null,
  phone: '',
  email: '',
  address: '',
  is_active: true,
  version: 1,
  created_at: '',
  updated_at: '',
}

function renderPage(path = '/suppliers') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <ToastProvider>
              <SuppliersPage />
            </ToastProvider>
          }
          path="/suppliers"
        />
        <Route element={<p>Ficha del proveedor</p>} path="/suppliers/:id" />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.args.length = 0
  mocks.permissions = ['proveedores.ver', 'proveedores.gestionar']
  mocks.list = {
    isPending: false,
    isError: false,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [supplier],
    },
  }
})

it('lista un proveedor sin documento ni contacto usando marcadores neutros', () => {
  renderPage()
  const table = screen.getByRole('table', { name: 'Proveedores' })
  expect(within(table).getByText('Juan Pérez')).toBeInTheDocument()
  expect(within(table).getAllByText('—').length).toBeGreaterThanOrEqual(2)
  expect(
    screen.getByLabelText(/ámbito fiscal: ruc comercial/i),
  ).toBeInTheDocument()
})

it('al elegir un proveedor abre su ficha, sin panel lateral de vista previa', async () => {
  mocks.list = {
    isPending: false,
    isError: false,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [
        {
          ...supplier,
          identification_type: 'RUC',
          identification: '1790012345001',
          phone: '0999999999',
        },
      ],
    },
  }
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getAllByText('Juan Pérez')[0]!)
  expect(await screen.findByText('Ficha del proveedor')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('envía búsqueda, estado y página de la URL al servidor', () => {
  renderPage('/suppliers?search=0912&is_active=false&page=3')
  expect(mocks.args.at(-1)).toEqual({
    search: '0912',
    isActive: 'false',
    page: 3,
  })
})

it('ofrece gestión solo con proveedores.gestionar', () => {
  mocks.permissions = ['proveedores.ver']
  renderPage()
  expect(screen.queryByRole('button', { name: /nuevo proveedor/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
})

it('distingue error de carga y sin coincidencias', () => {
  mocks.list = { isPending: false, isError: true }
  const { unmount } = renderPage()
  expect(
    screen.getByText(/no fue posible consultar los proveedores/i),
  ).toBeInTheDocument()
  unmount()
  mocks.list = {
    isPending: false,
    isError: false,
    data: { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] },
  }
  renderPage('/suppliers?search=zzz')
  expect(screen.getByText('Sin coincidencias')).toBeInTheDocument()
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  query: {} as Record<string, unknown>,
  setActive: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/suppliers/hooks', () => ({
  useSupplier: () => mocks.query,
  useSupplierMutations: () => ({ setActive: { mutateAsync: mocks.setActive } }),
}))
vi.mock('@/features/suppliers/SupplierDetails', () => ({
  SupplierDetails: ({ supplier }: { supplier: { name: string } }) => (
    <p>Detalle de {supplier.name}</p>
  ),
}))

import { SupplierDetailPage } from './SupplierDetailPage'

const supplier = {
  id: 6,
  name: 'Importadora Norte',
  identification_type: 'RUC',
  identification: '1790012345001',
  phone: '',
  email: '',
  address: '',
  is_active: true,
  version: 2,
  created_at: '',
  updated_at: '',
}

function Destination() {
  const location = useLocation()
  return <p>{location.pathname}</p>
}

function renderPage(
  entry:
    | string
    | { pathname: string; state?: { from: string } } = '/suppliers/6',
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <Routes>
          <Route element={<SupplierDetailPage />} path="/suppliers/:id" />
          <Route element={<Destination />} path="/suppliers/:id/edit" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = ['proveedores.ver', 'proveedores.gestionar']
  mocks.query = {
    data: supplier,
    isPending: false,
    isError: false,
    error: null,
  }
  mocks.setActive.mockResolvedValue(supplier)
})

it('preserves the list query in the back link and navigates to edit', async () => {
  const user = userEvent.setup()
  renderPage({ pathname: '/suppliers/6', state: { from: '?page=3' } })

  expect(
    screen.getByRole('link', { name: 'Volver a proveedores' }),
  ).toHaveAttribute('href', '/suppliers?page=3')
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  expect(screen.getByText('/suppliers/6/edit')).toBeInTheDocument()
})

it('hides management actions without permission', () => {
  mocks.permissions = ['proveedores.ver']
  renderPage()
  expect(screen.getByText('Detalle de Importadora Norte')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Desactivar' })).toBeNull()
})

it('distinguishes loading, missing supplier and generic failures', () => {
  mocks.query = { isPending: true, isError: false }
  const { unmount } = renderPage()
  expect(screen.getByText('Cargando proveedor…')).toBeInTheDocument()
  unmount()

  mocks.query = {
    isPending: false,
    isError: true,
    error: new ProblemError('No existe', 404, 'not_found'),
  }
  const missing = renderPage()
  expect(screen.getByText('Proveedor no encontrado')).toBeInTheDocument()
  missing.unmount()

  mocks.query = { isPending: false, isError: true, error: new Error('red') }
  renderPage()
  expect(screen.getByText('Error de carga')).toBeInTheDocument()
})

it('deactivates and reactivates a supplier with the current version', async () => {
  const user = userEvent.setup()
  const first = renderPage()
  await user.click(screen.getByRole('button', { name: 'Desactivar' }))
  await user.click(
    screen.getByRole('button', { name: 'Confirmar desactivación' }),
  )
  expect(mocks.setActive).toHaveBeenLastCalledWith({
    id: 6,
    active: false,
    expectedVersion: 2,
    key: expect.any(String),
  })
  expect(
    await screen.findByText('Proveedor «Importadora Norte» desactivado.'),
  ).toBeInTheDocument()
  first.unmount()

  mocks.query = { ...mocks.query, data: { ...supplier, is_active: false } }
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Reactivar' }))
  await user.click(
    screen.getByRole('button', { name: 'Confirmar reactivación' }),
  )
  expect(mocks.setActive).toHaveBeenLastCalledWith(
    expect.objectContaining({ active: true }),
  )
  expect(
    await screen.findByText('Proveedor «Importadora Norte» reactivado.'),
  ).toBeInTheDocument()
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
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
vi.mock('@/features/services/hooks', () => ({
  useService: () => mocks.query,
  useServiceMutations: () => ({ setActive: { mutateAsync: mocks.setActive } }),
}))
vi.mock('@/features/services/ServiceDetails', () => ({
  ServiceDetails: ({ service }: { service: { name: string } }) => (
    <p>Detalle de {service.name}</p>
  ),
}))
vi.mock('@/features/services/ServiceEditorModal', () => ({
  ServiceEditorModal: ({
    mode,
    onSaved,
  }: {
    mode: { name: string } | null
    onSaved: (message: string) => void
  }) =>
    mode ? (
      <button onClick={() => onSaved('Servicio actualizado')} type="button">
        Guardar edición
      </button>
    ) : null,
}))

import { ServiceDetailPage } from './ServiceDetailPage'

const service = {
  id: 3,
  name: 'Alineación',
  description: '',
  reference_price: '25.00',
  tax: null,
  is_active: true,
  version: 4,
  created_at: '',
  updated_at: '',
}

function renderPage(path = '/services/3') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route element={<ServiceDetailPage />} path="/services/:id" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = ['servicios.ver', 'servicios.gestionar']
  mocks.query = {
    data: service,
    isPending: false,
    isError: false,
    error: null,
  }
  mocks.setActive.mockResolvedValue(service)
})

it('distinguishes loading, not found and recoverable query failures', () => {
  mocks.query = { isPending: true, isError: false }
  const { rerender } = renderPage()
  expect(screen.getByText('Cargando servicio…')).toBeInTheDocument()

  mocks.query = {
    isPending: false,
    isError: true,
    error: new ProblemError('No existe', 404, 'not_found'),
  }
  rerender(
    <MemoryRouter initialEntries={['/services/3']}>
      <ToastProvider>
        <Routes>
          <Route element={<ServiceDetailPage />} path="/services/:id" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
  expect(screen.getByText('Servicio no encontrado')).toBeInTheDocument()

  mocks.query = {
    isPending: false,
    isError: true,
    error: new Error('red'),
  }
  rerender(
    <MemoryRouter initialEntries={['/services/3']}>
      <ToastProvider>
        <Routes>
          <Route element={<ServiceDetailPage />} path="/services/:id" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
  expect(screen.getByText('Error de carga')).toBeInTheDocument()
})

it('hides management actions without permission', () => {
  mocks.permissions = ['servicios.ver']
  renderPage()
  expect(screen.getByText('Detalle de Alineación')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Desactivar' })).toBeNull()
})

it('opens editing and communicates a saved service with a toast', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: 'Editar' }))
  await user.click(screen.getByRole('button', { name: 'Guardar edición' }))
  expect(screen.getByText('Servicio actualizado')).toBeInTheDocument()
})

it('deactivates an active service with version control and confirms the result', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: 'Desactivar' }))
  expect(
    screen.getByRole('dialog', { name: 'Desactivar servicio' }),
  ).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Confirmar desactivación' }),
  )

  expect(mocks.setActive).toHaveBeenCalledWith({
    id: 3,
    active: false,
    expectedVersion: 4,
    key: expect.any(String),
  })
  expect(
    await screen.findByText('Servicio «Alineación» desactivado.'),
  ).toBeInTheDocument()
})

it('offers reactivation for an inactive service', async () => {
  const user = userEvent.setup()
  mocks.query = { ...mocks.query, data: { ...service, is_active: false } }
  renderPage()

  await user.click(screen.getByRole('button', { name: 'Reactivar' }))
  await user.click(
    screen.getByRole('button', { name: 'Confirmar reactivación' }),
  )
  expect(mocks.setActive).toHaveBeenCalledWith(
    expect.objectContaining({ active: true }),
  )
  expect(
    await screen.findByText('Servicio «Alineación» reactivado.'),
  ).toBeInTheDocument()
})

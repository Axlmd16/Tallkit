import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  list: {} as Record<string, unknown>,
  taxCalls: 0,
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/services/hooks', () => ({
  useServices: () => mocks.list,
  useService: () => ({ data: undefined, refetch: vi.fn() }),
  useServiceMutations: () => ({
    create: { mutateAsync: vi.fn() },
    update: { mutateAsync: vi.fn() },
    setActive: { mutateAsync: vi.fn() },
  }),
  useServiceTaxOptions: () => {
    mocks.taxCalls += 1
    return { isPending: false, isSuccess: true, data: { results: [] } }
  },
}))

import { ServicesPage } from './ServicesPage'
import { ToastProvider } from '@/shared/ui'

const service = {
  id: 1,
  name: 'Alineación',
  description: '',
  reference_price: '25.00',
  tax: null,
  is_active: true,
  version: 1,
  created_at: '',
  updated_at: '',
}

beforeEach(() => {
  mocks.taxCalls = 0
  mocks.permissions = ['servicios.ver']
  mocks.list = {
    isPending: false,
    isError: false,
    data: {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results: [service],
    },
  }
})

it('muestra precio referencial y ámbito artesanal sin stock ni cobros', () => {
  render(
    <MemoryRouter>
      <ToastProvider>
        <ServicesPage />
      </ToastProvider>
    </MemoryRouter>,
  )
  const table = screen.getByRole('table', { name: 'Servicios' })
  expect(within(table).getByText('USD 25.00')).toBeInTheDocument()
  expect(
    screen.getByLabelText(/ámbito fiscal: ruc artesanal/i),
  ).toBeInTheDocument()
  expect(table.textContent).not.toMatch(/stock|existencia|costo|cobro/i)
})

it('al elegir un servicio abre su ficha, sin panel lateral de vista previa', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/services']}>
      <Routes>
        <Route
          element={
            <ToastProvider>
              <ServicesPage />
            </ToastProvider>
          }
          path="/services"
        />
        <Route element={<p>Ficha del servicio</p>} path="/services/:id" />
      </Routes>
    </MemoryRouter>,
  )

  await user.click(screen.getAllByText('Alineación')[0]!)
  expect(await screen.findByText('Ficha del servicio')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('la consulta no ofrece gestión ni consulta opciones fiscales administrativas', () => {
  render(
    <MemoryRouter>
      <ToastProvider>
        <ServicesPage />
      </ToastProvider>
    </MemoryRouter>,
  )
  expect(screen.queryByRole('button', { name: /nuevo servicio/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
  expect(mocks.taxCalls).toBe(0)
})

it('el Encargado con gestión puede crear, editar y desactivar', async () => {
  mocks.permissions = ['servicios.ver', 'servicios.gestionar']
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ToastProvider>
        <ServicesPage />
      </ToastProvider>
    </MemoryRouter>,
  )
  expect(
    screen.getAllByRole('button', { name: /editar/i }).length,
  ).toBeGreaterThan(0)
  expect(
    screen.getAllByRole('button', { name: /desactivar/i }).length,
  ).toBeGreaterThan(0)
  await user.click(screen.getByRole('button', { name: /nuevo servicio/i }))
  expect(
    await screen.findByRole('dialog', { name: /nuevo servicio/i }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cerrar panel' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
})

it.each([
  ['carga', { isPending: true, isError: false }, /cargando servicios/i],
  [
    'error',
    { isPending: false, isError: true },
    /no fue posible consultar los servicios/i,
  ],
  [
    'vacío',
    {
      isPending: false,
      isError: false,
      data: { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] },
    },
    /no hay servicios/i,
  ],
])('presenta el estado de %s', (_name, state, text) => {
  mocks.list = state
  render(
    <MemoryRouter>
      <ToastProvider>
        <ServicesPage />
      </ToastProvider>
    </MemoryRouter>,
  )
  expect(screen.getAllByText(text)[0]).toBeInTheDocument()
})

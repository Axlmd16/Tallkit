import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  detail: {} as Record<string, unknown>,
  vehicles: [] as unknown[],
}))

vi.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceOrder: () => mocks.detail,
  useMaintenanceMutations: () => ({
    create: { mutateAsync: mocks.create, isPending: false },
    update: { mutateAsync: mocks.update, isPending: false },
  }),
  useCustomerPickerOptions: () => ({
    isPending: false,
    isError: false,
    data: { totalPages: 1, options: [{ id: 3, label: 'Ana Pérez' }] },
  }),
  useVehicleOptions: (customerId: number | null) => ({
    isPending: false,
    data: customerId
      ? {
          count: mocks.vehicles.length,
          page: 1,
          page_size: 20,
          total_pages: 1,
          results: mocks.vehicles,
        }
      : undefined,
  }),
}))

import { MaintenanceOrderEditorPage } from './MaintenanceOrderEditorPage'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}</p>
}

function renderEditor(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={<MaintenanceOrderEditorPage />}
            path="/maintenance/new"
          />
          <Route
            element={<MaintenanceOrderEditorPage />}
            path="/maintenance/:id/edit"
          />
          <Route element={<Where />} path="/maintenance/:id" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

const hilux = {
  id: 4,
  plate: 'ABC-1234',
  brand: 'Toyota',
  model: 'Hilux',
  year: 2020,
  color: 'Blanco',
  open_order: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.detail = { isPending: false, isError: false, data: undefined }
  mocks.vehicles = [hilux]
  mocks.create.mockResolvedValue({ id: 9, number: 'ART-OT-000009' })
})

async function fillNewOrder(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Vehículo'), '4')
  await user.type(screen.getByLabelText('Kilometraje (km)'), '80000')
}

it('registra una orden con el cliente precargado y el vehículo del propietario', async () => {
  const user = userEvent.setup()
  renderEditor('/maintenance/new?customer_id=3&customer_name=Ana%20P%C3%A9rez')
  await fillNewOrder(user)
  await user.click(screen.getByRole('button', { name: 'Registrar orden' }))
  await waitFor(() => expect(mocks.create).toHaveBeenCalled())
  const [{ data, key }] = mocks.create.mock.calls[0] as [
    { data: Record<string, unknown>; key: string },
  ]
  expect(data).toMatchObject({
    customer_id: 3,
    vehicle_id: 4,
    odometer_km: 80000,
  })
  expect(key).toBeTruthy()
  expect(await screen.findByTestId('where')).toHaveTextContent('/maintenance/9')
})

it('valida campos obligatorios antes de enviar', async () => {
  const user = userEvent.setup()
  renderEditor('/maintenance/new')
  await user.click(screen.getByRole('button', { name: 'Registrar orden' }))
  expect(screen.getByText('Seleccione un cliente.')).toBeInTheDocument()
  expect(
    screen.getByText('Ingrese el kilometraje en kilómetros enteros.'),
  ).toBeInTheDocument()
  expect(mocks.create).not.toHaveBeenCalled()
})

it('advierte kilometraje menor, exige confirmación y conserva lo escrito', async () => {
  const user = userEvent.setup()
  mocks.create
    .mockRejectedValueOnce(
      new ProblemError(
        'Kilometraje menor.',
        400,
        'odometer_confirmation_required',
        undefined,
        { odometer_km: ['Kilometraje menor.'] },
        undefined,
        { last_known_km: 90000, order_id: 2, order_number: 'ART-OT-000002' },
      ),
    )
    .mockResolvedValueOnce({ id: 9, number: 'ART-OT-000009' })
  renderEditor('/maintenance/new?customer_id=3')
  await fillNewOrder(user)
  await user.type(screen.getByLabelText('Diagnóstico'), 'Frenos')
  await user.click(screen.getByRole('button', { name: 'Registrar orden' }))
  expect(await screen.findByText(/ART-OT-000002 registró/)).toBeInTheDocument()
  expect(screen.getByLabelText('Diagnóstico')).toHaveValue('Frenos')
  await user.click(
    screen.getByLabelText('Confirmo que el kilometraje ingresado es correcto'),
  )
  await user.click(screen.getByRole('button', { name: 'Registrar orden' }))
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
  const second = mocks.create.mock.calls[1]?.[0] as {
    data: Record<string, unknown>
  }
  expect(second.data.odometer_confirmed).toBe(true)
})

it('impide registrar si el vehículo ya tiene una orden abierta', () => {
  mocks.vehicles = [
    { ...hilux, open_order: { id: 5, number: 'ART-OT-000005' } },
  ]
  renderEditor('/maintenance/new?customer_id=3&vehicle_id=4')
  expect(
    screen.getByText('El vehículo ya tiene una orden abierta'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Registrar orden' })).toBeDisabled()
})

it('ante un conflicto de versión ofrece recargar conservando lo escrito', async () => {
  const user = userEvent.setup()
  const refetch = vi.fn().mockResolvedValue({})
  mocks.detail = {
    isPending: false,
    isError: false,
    refetch,
    data: {
      id: 9,
      number: 'ART-OT-000009',
      state: 'REGISTERED',
      version: 2,
      customer: {
        id: 3,
        name: 'Ana Pérez',
        identification: '1',
        is_active: true,
      },
      vehicle: { ...hilux, is_active: true },
      opened_on: '2026-09-20',
      odometer_km: 80000,
      diagnosis: '',
      notes: '',
    },
  }
  mocks.update.mockRejectedValueOnce(
    new ProblemError('La orden cambió.', 409, 'stale_record'),
  )
  renderEditor('/maintenance/9/edit')
  await user.type(screen.getByLabelText('Diagnóstico'), 'Nuevo texto')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await user.click(
    await screen.findByRole('button', {
      name: 'Cargar la versión vigente conservando lo escrito',
    }),
  )
  expect(refetch).toHaveBeenCalled()
  expect(await screen.findByText('Versión vigente cargada')).toBeInTheDocument()
  expect(screen.getByLabelText('Diagnóstico')).toHaveValue('Nuevo texto')
})

it('no permite editar una orden finalizada', () => {
  mocks.detail = {
    isPending: false,
    isError: false,
    data: { id: 9, state: 'FINALIZED' },
  }
  renderEditor('/maintenance/9/edit')
  expect(screen.getByText('La orden no admite edición')).toBeInTheDocument()
})

it('el resumen refleja cliente, vehículo, fecha y kilometraje mientras se llena', async () => {
  const user = userEvent.setup()
  renderEditor(
    '/maintenance/new?customer_id=3&customer_name=Transportes%20Andinos%20S.A.',
  )
  const summary = screen.getByRole('region', { name: 'Resumen de la orden' })
  expect(summary).toHaveTextContent('Transportes Andinos S.A.')
  expect(summary).toHaveTextContent('VehículoSin seleccionar')
  await fillNewOrder(user)
  expect(summary).toHaveTextContent('ABC-1234')
  expect(summary).toHaveTextContent('Toyota Hilux · 2020 · Blanco')
  expect(summary).toHaveTextContent(/80\.000 km/)
})

it('si la sesión venció, informa el rechazo y conserva lo escrito', async () => {
  const user = userEvent.setup()
  mocks.create.mockRejectedValueOnce(
    new ProblemError(
      'No tiene permiso para realizar esta acción.',
      403,
      'permission_denied',
    ),
  )
  renderEditor('/maintenance/new?customer_id=3')
  await fillNewOrder(user)
  await user.type(screen.getByLabelText('Diagnóstico'), 'Ruido en frenos')
  await user.click(screen.getByRole('button', { name: 'Registrar orden' }))
  expect(await screen.findByText('No se guardó la orden')).toBeInTheDocument()
  expect(screen.getByLabelText('Diagnóstico')).toHaveValue('Ruido en frenos')
  expect(screen.getByLabelText('Kilometraje (km)')).toHaveValue('80000')
  expect(screen.getByLabelText('Vehículo', { selector: 'select' })).toHaveValue(
    '4',
  )
  expect(screen.queryByTestId('where')).not.toBeInTheDocument()
})

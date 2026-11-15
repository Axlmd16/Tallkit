import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  create: vi.fn(),
  search: [] as unknown[],
  openOrder: null as null | { id: number; number: string },
  receivable: '0.00',
  artisan: '0.00',
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useBusinessName: (scope: string) =>
    scope === 'commercial' ? 'Almacén' : 'Taller',
}))
vi.mock('@/features/vehicles/hooks', () => ({
  useVehicles: (filters: { search?: string }) => {
    mocks.search.push(filters)
    return {
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      data: filters.search ? { results: [VEHICLE, NO_OWNER] } : { results: [] },
    }
  },
}))
vi.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceMutations: () => ({
    create: { isPending: false, mutateAsync: mocks.create },
  }),
  useMaintenanceOrders: () => ({
    data: {
      results: [{ id: 5, opened_on: '2026-06-12', odometer_km: 84300 }],
    },
  }),
  useVehicleOptions: () => ({
    data: { results: [{ id: 4, open_order: mocks.openOrder }] },
  }),
}))
vi.mock('@/features/sales/hooks', () => ({
  useReceivables: (_filters: unknown, enabled?: boolean) => ({
    data:
      enabled === false ? undefined : { receivable_total: mocks.receivable },
  }),
}))
vi.mock('@/features/maintenance/billingHooks', () => ({
  useArtisanReceivables: (_filters: unknown, enabled?: boolean) => ({
    data:
      enabled === false ? undefined : { totals: { balance: mocks.artisan } },
  }),
}))

import { NewMaintenanceDialog } from './NewMaintenanceDialog'

const VEHICLE = {
  id: 4,
  plate: 'GBA-1234',
  model: 'Aveo',
  color: 'plateado',
  year: 2016,
  brand: { id: 1, name: 'Chevrolet', is_active: true },
  current_owner: { id: 3, name: 'Carlos Mendoza' },
}
const NO_OWNER = { ...VEHICLE, id: 8, plate: 'SIN-0001', current_owner: null }

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}</p>
}

function renderDialog() {
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <Routes>
          <Route
            element={<NewMaintenanceDialog onClose={onClose} open />}
            path="/"
          />
          <Route element={<Where />} path="/maintenance/:id" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
  return onClose
}

async function pickVehicle(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: /Qué vehículo/ }), 'GBA')
  await user.click(await screen.findByRole('button', { name: /GBA-1234/ }))
}

beforeEach(() => {
  mocks.permissions = ['pagos_comerciales.ver', 'pagos_artesanales.ver']
  mocks.create.mockReset()
  mocks.search.length = 0
  mocks.openOrder = null
  mocks.receivable = '0.00'
  mocks.artisan = '0.00'
})

it('abre el mantenimiento con el dueño, el kilometraje y lo que pide el cliente', async () => {
  const user = userEvent.setup()
  mocks.create.mockResolvedValue({ id: 9, number: 'ART-OT-000009' })
  const onClose = renderDialog()

  const open = screen.getByRole('button', { name: 'Abrir mantenimiento' })
  expect(open).toBeDisabled()
  await pickVehicle(user)
  expect(screen.getByText('Dueño: Carlos Mendoza')).toBeVisible()
  expect(screen.getByText('84.300 km')).toBeVisible()

  await user.type(
    screen.getByRole('textbox', { name: 'Kilometraje de hoy' }),
    '85000',
  )
  await user.click(screen.getByRole('button', { name: 'Frenos' }))
  await user.click(screen.getByRole('button', { name: 'Alineación' }))
  await user.click(open)

  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.create.mock.calls[0]![0].data).toMatchObject({
    customer_id: 3,
    vehicle_id: 4,
    odometer_km: 85000,
    diagnosis: '',
    notes: 'Pide el cliente: Frenos, Alineación.',
  })
  expect(await screen.findByTestId('where')).toHaveTextContent('/maintenance/9')
  expect(onClose).toHaveBeenCalled()
})

it('sin texto no lista vehículos y nunca ofrece uno sin dueño vigente', async () => {
  const user = userEvent.setup()
  renderDialog()
  expect(screen.queryByRole('button', { name: /GBA-1234/ })).toBeNull()
  await user.type(screen.getByRole('textbox', { name: /Qué vehículo/ }), 'GBA')
  expect(await screen.findByRole('button', { name: /GBA-1234/ })).toBeVisible()
  expect(screen.queryByRole('button', { name: /SIN-0001/ })).toBeNull()
})

it('un kilometraje menor al último pide confirmación y la reenvía confirmada', async () => {
  const user = userEvent.setup()
  mocks.create
    .mockRejectedValueOnce(
      new ProblemError(
        'Kilometraje menor.',
        400,
        'odometer_confirmation_required',
        undefined,
        undefined,
        undefined,
        { last_known_km: 84300, order_id: 5, order_number: 'ART-OT-000005' },
      ),
    )
    .mockResolvedValueOnce({ id: 9, number: 'ART-OT-000009' })
  renderDialog()
  await pickVehicle(user)
  await user.type(
    screen.getByRole('textbox', { name: 'Kilometraje de hoy' }),
    '100',
  )
  await user.click(screen.getByRole('button', { name: 'Abrir mantenimiento' }))

  expect(
    await screen.findByText('Kilometraje menor al último conocido'),
  ).toBeVisible()
  const open = screen.getByRole('button', { name: 'Abrir mantenimiento' })
  expect(open).toBeDisabled()
  await user.click(screen.getByRole('checkbox'))
  await user.click(open)
  expect(mocks.create.mock.calls[1]![0].data).toMatchObject({
    odometer_confirmed: true,
  })
})

it('avisa la deuda de cada negocio por separado y nunca la suma', async () => {
  const user = userEvent.setup()
  mocks.receivable = '18.00'
  mocks.artisan = '5.00'
  renderDialog()
  await pickVehicle(user)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/USD 18\.00/)).toBeVisible()
  expect(within(dialog).getByText(/USD 5\.00/)).toBeVisible()
  expect(within(dialog).queryByText(/USD 23\.00/)).toBeNull()
})

it('sin permiso de cuentas no consulta ni avisa deudas', async () => {
  const user = userEvent.setup()
  mocks.permissions = []
  mocks.receivable = '18.00'
  renderDialog()
  await pickVehicle(user)
  expect(screen.queryByText(/Este cliente debe/)).toBeNull()
})

it('un vehículo con mantenimiento abierto no permite abrir otro', async () => {
  const user = userEvent.setup()
  mocks.openOrder = { id: 2, number: 'ART-OT-000002' }
  renderDialog()
  await pickVehicle(user)
  await user.type(
    screen.getByRole('textbox', { name: 'Kilometraje de hoy' }),
    '90000',
  )
  expect(screen.getByRole('link', { name: 'ART-OT-000002' })).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Abrir mantenimiento' }),
  ).toBeDisabled()
})

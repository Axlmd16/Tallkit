import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as authHooks from '@/features/auth/hooks'
import * as vehicleHooks from '@/features/vehicles/hooks'
import type {
  OwnershipPeriod,
  OwnershipPeriodPage,
  VehicleSummary,
} from '@/features/vehicles/types'
import { ProblemError } from '@/shared/api/client'

import { VehicleDetailPage } from './VehicleDetailPage'

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

vi.mock('@/features/customers/hooks', () => ({
  useCustomers: () => ({
    data: {
      results: [
        {
          id: 10,
          name: 'Carlos Vera',
          identification: '0912345678',
          is_active: true,
        },
        {
          id: 20,
          name: 'María López',
          identification: '0923456789',
          is_active: true,
        },
      ],
    },
    isLoading: false,
  }),
}))

const sampleVehicle: VehicleSummary = {
  id: 42,
  plate: 'ABC-1234',
  model: 'Corolla',
  color: 'Blanco',
  year: 2023,
  vin: '1HGCR2F83HA000001',
  is_active: true,
  version: 1,
  created_at: '2026-09-13T00:00:00Z',
  updated_at: '2026-09-13T00:00:00Z',
  brand: { id: 1, name: 'Toyota', is_active: true },
  current_owner: {
    id: 10,
    name: 'Carlos Vera',
    identification: '0912345678',
    is_active: true,
  },
}

const samplePeriods: OwnershipPeriodPage = {
  count: 1,
  page: 1,
  page_size: 10,
  total_pages: 1,
  results: [
    {
      id: 100,
      vehicle_id: 42,
      customer: {
        id: 10,
        name: 'Carlos Vera',
        identification: '0912345678',
        is_active: true,
      },
      started_at: '2026-09-13T10:00:00Z',
      ended_at: null,
      is_current: true,
    } as OwnershipPeriod,
  ],
}

function renderComponent(vehicleId = '42') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/vehicles/${vehicleId}`]}>
        <Routes>
          <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
          <Route path="/vehicles" element={<div>Vehicles List</div>} />
          <Route path="/customers/:id" element={<div>Customer Profile</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VehicleDetailPage', () => {
  const mockRefetch = vi.fn()
  const mockUpdateVehicle = vi.fn().mockResolvedValue(sampleVehicle)
  const mockChangeOwner = vi.fn().mockResolvedValue(sampleVehicle)
  const mockActivateVehicle = vi.fn().mockResolvedValue(sampleVehicle)
  const mockDeactivateVehicle = vi.fn().mockResolvedValue(sampleVehicle)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(vehicleHooks, 'useVehicle').mockReturnValue({
      data: sampleVehicle,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicle>)

    vi.spyOn(vehicleHooks, 'useVehicleOwnershipPeriods').mockReturnValue({
      data: samplePeriods,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicleOwnershipPeriods>)

    vi.spyOn(vehicleHooks, 'useVehicleMutations').mockReturnValue({
      updateVehicle: { mutateAsync: mockUpdateVehicle },
      changeOwner: { mutateAsync: mockChangeOwner },
      activateVehicle: { mutateAsync: mockActivateVehicle },
      deactivateVehicle: { mutateAsync: mockDeactivateVehicle },
    } as unknown as ReturnType<typeof vehicleHooks.useVehicleMutations>)
  })

  it('renders complete vehicle details, current owner and ownership periods', () => {
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'vendedor',
        roles: ['VENDEDOR'],
        permissions: ['vehiculos.ver'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    renderComponent()

    expect(
      screen.getByRole('heading', { name: 'ABC-1234' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Toyota Corolla')).toBeInTheDocument()
    expect(screen.getByText('Blanco')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.getByText('1HGCR2F83HA000001')).toBeInTheDocument()

    // Current owner
    const ownerLinks = screen.getAllByRole('link', { name: 'Carlos Vera' })
    expect(ownerLinks.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('0912345678').length).toBeGreaterThanOrEqual(1)

    // Ownership periods table
    expect(
      screen.getByRole('heading', {
        name: 'Historial de períodos de propiedad',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Vigente').length).toBeGreaterThanOrEqual(1)

    // Vendedor should NOT see "Editar vehículo" nor "Cambiar propietario"
    expect(
      screen.queryByRole('button', { name: 'Editar vehículo' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cambiar propietario' }),
    ).not.toBeInTheDocument()
  })

  it('shows "Editar vehículo" and "Cambiar propietario" buttons for Encargado', async () => {
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'encargado',
        roles: ['ENCARGADO_TALLER'],
        permissions: ['vehiculos.ver', 'vehiculos.gestionar'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    const user = userEvent.setup()
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Editar vehículo' }),
    ).toBeInTheDocument()
    const transferBtn = screen.getByRole('button', {
      name: 'Cambiar propietario',
    })
    expect(transferBtn).toBeInTheDocument()

    await user.click(transferBtn)
    expect(
      screen.getByRole('dialog', { name: 'Cambiar propietario' }),
    ).toBeInTheDocument()
  })

  it('successfully transfers ownership to a new customer', async () => {
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'encargado',
        roles: ['ENCARGADO_TALLER'],
        permissions: ['vehiculos.ver', 'vehiculos.gestionar'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    const user = userEvent.setup()
    renderComponent()

    await user.click(
      screen.getByRole('button', { name: 'Cambiar propietario' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Cambiar propietario' })
    expect(dialog).toBeInTheDocument()

    // Select María López (id: 20)
    const select = screen.getByLabelText('Nuevo cliente propietario')
    await user.selectOptions(select, '20')

    // Click confirm
    const confirmBtn = screen.getByRole('button', {
      name: 'Confirmar transferencia',
    })
    await user.click(confirmBtn)

    expect(mockChangeOwner).toHaveBeenCalledWith({
      id: 42,
      data: {
        owner_id: 20,
        expected_version: 1,
      },
      previousOwnerId: 10,
    })

    expect(
      await screen.findByText(
        'La propiedad del vehículo fue transferida exitosamente.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: 'Cambiar propietario' }),
    ).not.toBeInTheDocument()
  })

  it('recovers from concurrency conflict without losing form state', async () => {
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'encargado',
        roles: ['ENCARGADO_TALLER'],
        permissions: ['vehiculos.ver', 'vehiculos.gestionar'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    mockChangeOwner.mockRejectedValueOnce(
      new ProblemError('Conflicto de versión.', 409, 'stale_record'),
    )

    const user = userEvent.setup()
    renderComponent()

    await user.click(
      screen.getByRole('button', { name: 'Cambiar propietario' }),
    )
    const select = screen.getByLabelText('Nuevo cliente propietario')
    await user.selectOptions(select, '20')

    await user.click(
      screen.getByRole('button', { name: 'Confirmar transferencia' }),
    )

    // Shows conflict notice with reload button
    expect(
      await screen.findByText('Conflicto de concurrencia'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'La ficha del vehículo o el propietario fue modificado por otro usuario.',
      ),
    ).toBeInTheDocument()

    // The selected option is preserved
    expect(select).toHaveValue('20')

    // Click reload button
    const reloadBtn = screen.getByRole('button', {
      name: 'Actualizar datos del vehículo',
    })
    await user.click(reloadBtn)
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('allows administrator to deactivate and reactivate vehicle on detail page', async () => {
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'admin',
        roles: ['ADMINISTRADOR'],
        permissions: [
          'vehiculos.ver',
          'vehiculos.gestionar',
          'vehiculos.desactivar',
        ],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    const user = userEvent.setup()
    renderComponent()

    const deactBtn = screen.getByRole('button', { name: 'Desactivar' })
    expect(deactBtn).toBeInTheDocument()

    await user.click(deactBtn)
    const dialog = screen.getByRole('dialog', { name: 'Desactivar vehículo' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('ABC-1234')

    await user.click(
      screen.getByRole('button', { name: 'Confirmar desactivación' }),
    )

    expect(mockDeactivateVehicle).toHaveBeenCalledWith({
      id: 42,
      expectedVersion: 1,
    })
  })

  it('shows error when deactivation fails with version conflict', async () => {
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'admin',
        roles: ['ADMINISTRADOR'],
        permissions: [
          'vehiculos.ver',
          'vehiculos.gestionar',
          'vehiculos.desactivar',
        ],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    mockDeactivateVehicle.mockRejectedValueOnce(
      new ProblemError('Conflicto.', 409, 'stale_record'),
    )

    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Desactivar' }))
    await user.click(
      screen.getByRole('button', { name: 'Confirmar desactivación' }),
    )

    expect(
      await screen.findByText(
        'La ficha del vehículo fue modificada por otro usuario. Recargue la página para ver la versión más reciente.',
      ),
    ).toBeInTheDocument()
  })

  it('shows loading state while vehicle is fetching', () => {
    vi.spyOn(vehicleHooks, 'useVehicle').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicle>)

    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'vendedor',
        roles: ['VENDEDOR'],
        permissions: ['vehiculos.ver'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    renderComponent()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows error state when vehicle fails to load', () => {
    vi.spyOn(vehicleHooks, 'useVehicle').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicle>)

    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'vendedor',
        roles: ['VENDEDOR'],
        permissions: ['vehiculos.ver'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    renderComponent()
    expect(
      screen.getByText(/El vehículo solicitado no existe/i),
    ).toBeInTheDocument()
  })

  it('renders correctly when vehicle has no optional fields (no VIN, color or year)', () => {
    const minimalVehicle = {
      ...sampleVehicle,
      vin: null,
      color: null,
      year: null,
    }
    vi.spyOn(vehicleHooks, 'useVehicle').mockReturnValue({
      data: minimalVehicle,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof vehicleHooks.useVehicle>)

    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'vendedor',
        roles: ['VENDEDOR'],
        permissions: ['vehiculos.ver'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    renderComponent()
    expect(
      screen.getByRole('heading', { name: 'ABC-1234' }),
    ).toBeInTheDocument()
    // No crash for missing optional fields
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('allows encargado to open edit drawer for vehicle', async () => {
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'encargado',
        roles: ['ENCARGADO_TALLER'],
        permissions: ['vehiculos.ver', 'vehiculos.gestionar'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    const user = userEvent.setup()
    renderComponent()

    const editBtn = screen.getByRole('button', { name: 'Editar vehículo' })
    await user.click(editBtn)

    expect(
      screen.getByRole('dialog', { name: 'Editar vehículo' }),
    ).toBeInTheDocument()
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as authHooks from '@/features/auth/hooks'
import * as vehicleHooks from '@/features/vehicles/hooks'
import type { VehicleSummary } from '@/features/vehicles/types'
import { ProblemError } from '@/shared/api/client'

import { VehiclesPage } from './VehiclesPage'

vi.mock('@/features/vehicle-brands/hooks', () => ({
  useVehicleBrands: () => ({
    data: {
      results: [
        { id: 1, name: 'Toyota', is_active: true },
        { id: 2, name: 'Chevrolet', is_active: true },
      ],
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
      ],
    },
    isLoading: false,
  }),
}))

const sampleVehicle: VehicleSummary = {
  id: 100,
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

function renderComponent() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VehiclesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VehiclesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(vehicleHooks, 'useVehicles').mockReturnValue({
      data: {
        count: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
        results: [sampleVehicle],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicles>)

    vi.spyOn(vehicleHooks, 'useVehicleMutations').mockReturnValue({
      createVehicle: { mutateAsync: vi.fn().mockResolvedValue(sampleVehicle) },
      updateVehicle: { mutateAsync: vi.fn().mockResolvedValue(sampleVehicle) },
      activateVehicle: {
        mutateAsync: vi.fn().mockResolvedValue(sampleVehicle),
      },
      deactivateVehicle: {
        mutateAsync: vi.fn().mockResolvedValue(sampleVehicle),
      },
    } as unknown as ReturnType<typeof vehicleHooks.useVehicleMutations>)
  })

  it('renders vehicles list with full information for Encargado and shows management controls', async () => {
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'encargado',
        roles: ['ENCARGADO_TALLER'],
        permissions: ['vehiculos.ver', 'vehiculos.gestionar'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    renderComponent()

    expect(
      screen.getByRole('heading', { name: 'Vehículos' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Registrar vehículo' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('ABC-1234')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Toyota Corolla')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Carlos Vera')[0]).toBeInTheDocument()
    expect(screen.getAllByText('1HGCR2F83HA000001')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Activo')[0]).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /Ver ficha/i })[0],
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /Editar/i })[0],
    ).toBeInTheDocument()
  })

  it('does NOT show creation or editing controls to Vendedor role', async () => {
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
      screen.queryByRole('button', { name: 'Registrar vehículo' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Editar/i }),
    ).not.toBeInTheDocument()
    // But data and ficha link are visible
    expect(screen.getAllByText('ABC-1234')[0]).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /Ver ficha/i })[0],
    ).toBeInTheDocument()
  })

  it('opens registration drawer and submits new vehicle', async () => {
    const mutations = {
      createVehicle: { mutateAsync: vi.fn().mockResolvedValue(sampleVehicle) },
      updateVehicle: { mutateAsync: vi.fn() },
    }
    vi.spyOn(vehicleHooks, 'useVehicleMutations').mockReturnValue(
      mutations as unknown as ReturnType<
        typeof vehicleHooks.useVehicleMutations
      >,
    )
    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'admin',
        roles: ['ADMINISTRADOR'],
        permissions: ['vehiculos.ver', 'vehiculos.gestionar'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Registrar vehículo' }))
    expect(
      screen.getByRole('dialog', { name: 'Registrar vehículo' }),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Propietario'), '10')
    await user.selectOptions(screen.getByLabelText('Marca de vehículo'), '1')
    await user.type(screen.getByLabelText('Placa'), 'XYZ-1234')
    await user.type(screen.getByLabelText('Modelo'), 'Yaris')

    await user.click(screen.getByRole('button', { name: 'Guardar vehículo' }))

    await waitFor(() => {
      expect(mutations.createVehicle.mutateAsync).toHaveBeenCalledWith({
        owner_id: 10,
        brand_id: 1,
        plate: 'XYZ-1234',
        model: 'Yaris',
        color: undefined,
        year: undefined,
        vin: undefined,
      })
    })
  })

  it('allows administrator to deactivate an active vehicle via dialog', async () => {
    const mutations = {
      createVehicle: { mutateAsync: vi.fn() },
      updateVehicle: { mutateAsync: vi.fn() },
      activateVehicle: { mutateAsync: vi.fn() },
      deactivateVehicle: {
        mutateAsync: vi.fn().mockResolvedValue({
          ...sampleVehicle,
          is_active: false,
          version: 2,
        }),
      },
    }
    vi.spyOn(vehicleHooks, 'useVehicleMutations').mockReturnValue(
      mutations as unknown as ReturnType<
        typeof vehicleHooks.useVehicleMutations
      >,
    )
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

    const deactBtn = screen.getAllByRole('button', { name: 'Desactivar' })[0]!
    expect(deactBtn).toBeInTheDocument()

    await user.click(deactBtn)
    const dialog = screen.getByRole('dialog', { name: 'Desactivar vehículo' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('ABC-1234')

    await user.click(
      screen.getByRole('button', { name: 'Confirmar desactivación' }),
    )

    await waitFor(() => {
      expect(mutations.deactivateVehicle.mutateAsync).toHaveBeenCalledWith({
        id: 100,
        expectedVersion: 1,
      })
    })
  })

  it('allows administrator to activate an inactive vehicle via dialog', async () => {
    const inactiveVehicle = { ...sampleVehicle, is_active: false }
    vi.spyOn(vehicleHooks, 'useVehicles').mockReturnValue({
      data: {
        count: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
        results: [inactiveVehicle],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicles>)

    const mutations = {
      createVehicle: { mutateAsync: vi.fn() },
      updateVehicle: { mutateAsync: vi.fn() },
      activateVehicle: {
        mutateAsync: vi.fn().mockResolvedValue({
          ...inactiveVehicle,
          is_active: true,
          version: 2,
        }),
      },
      deactivateVehicle: { mutateAsync: vi.fn() },
    }
    vi.spyOn(vehicleHooks, 'useVehicleMutations').mockReturnValue(
      mutations as unknown as ReturnType<
        typeof vehicleHooks.useVehicleMutations
      >,
    )
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

    const actBtn = screen.getAllByRole('button', { name: 'Activar' })[0]!
    expect(actBtn).toBeInTheDocument()

    await user.click(actBtn)
    const dialog = screen.getByRole('dialog', { name: 'Activar vehículo' })
    expect(dialog).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Confirmar activación' }),
    )

    await waitFor(() => {
      expect(mutations.activateVehicle.mutateAsync).toHaveBeenCalledWith({
        id: 100,
        expectedVersion: 1,
      })
    })
  })

  it('shows version conflict error when deactivation has stale version', async () => {
    const mutations = {
      createVehicle: { mutateAsync: vi.fn() },
      updateVehicle: { mutateAsync: vi.fn() },
      activateVehicle: { mutateAsync: vi.fn() },
      deactivateVehicle: {
        mutateAsync: vi
          .fn()
          .mockRejectedValue(
            new ProblemError('Conflicto de versión.', 409, 'stale_record'),
          ),
      },
    }
    vi.spyOn(vehicleHooks, 'useVehicleMutations').mockReturnValue(
      mutations as unknown as ReturnType<
        typeof vehicleHooks.useVehicleMutations
      >,
    )
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

    const deactBtn = screen.getAllByRole('button', { name: 'Desactivar' })[0]!
    await user.click(deactBtn)
    await user.click(
      screen.getByRole('button', { name: 'Confirmar desactivación' }),
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'La ficha del vehículo fue modificada por otro usuario. Recargue la página para ver la versión más reciente.',
        ),
      ).toBeInTheDocument()
    })
  })

  it('shows loading skeleton while vehicles are fetching', () => {
    vi.spyOn(vehicleHooks, 'useVehicles').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicles>)

    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'admin',
        roles: ['ADMINISTRADOR'],
        permissions: ['vehiculos.ver', 'vehiculos.gestionar'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    renderComponent()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows error state when vehicles fail to load', () => {
    vi.spyOn(vehicleHooks, 'useVehicles').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicles>)

    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'admin',
        roles: ['ADMINISTRADOR'],
        permissions: ['vehiculos.ver'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    renderComponent()
    expect(
      screen.getByText(/Error de conexión/i),
    ).toBeInTheDocument()
  })

  it('shows empty state when no vehicles exist', () => {
    vi.spyOn(vehicleHooks, 'useVehicles').mockReturnValue({
      data: {
        count: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
        results: [],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof vehicleHooks.useVehicles>)

    vi.spyOn(authHooks, 'useSession').mockReturnValue({
      data: {
        authenticated: true,
        username: 'admin',
        roles: ['ADMINISTRADOR'],
        permissions: ['vehiculos.ver', 'vehiculos.gestionar'],
        must_change_password: false,
      },
    } as unknown as ReturnType<typeof authHooks.useSession>)

    renderComponent()
    expect(
      screen.getByText(/Aún no hay vehículos registrados en el taller/i),
    ).toBeInTheDocument()
  })

  it('opens edit drawer for an existing vehicle', async () => {
    const mutations = {
      createVehicle: { mutateAsync: vi.fn() },
      updateVehicle: { mutateAsync: vi.fn().mockResolvedValue(sampleVehicle) },
      activateVehicle: { mutateAsync: vi.fn() },
      deactivateVehicle: { mutateAsync: vi.fn() },
    }
    vi.spyOn(vehicleHooks, 'useVehicleMutations').mockReturnValue(
      mutations as unknown as ReturnType<typeof vehicleHooks.useVehicleMutations>,
    )
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

    const editBtns = screen.getAllByRole('button', { name: /Editar/i })
    await user.click(editBtns[0]!)

    expect(
      screen.getByRole('dialog', { name: 'Editar vehículo' }),
    ).toBeInTheDocument()
  })
})

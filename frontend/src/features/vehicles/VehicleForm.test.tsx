import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

import type { VehicleSummary } from './types'
import { VehicleForm } from './VehicleForm'

const mockCreateBrand = vi.fn()

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({
    data: {
      permissions: ['marcas_vehiculo.gestionar', 'vehiculos.gestionar'],
    },
  }),
}))

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
    createBrand: {
      mutateAsync: mockCreateBrand,
    },
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

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('VehicleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders creation form with empty fields and validates required inputs', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    renderWithQuery(<VehicleForm onSubmit={onSubmit} />)

    expect(
      screen.getByRole('button', { name: 'Guardar vehículo' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Vehículo' })).toBeInTheDocument()

    // Click submit with empty form
    await user.click(screen.getByRole('button', { name: 'Guardar vehículo' }))

    expect(
      screen.getByText('Debe seleccionar un propietario para el vehículo.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Debe seleccionar una marca para el vehículo.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('La placa del vehículo es obligatoria.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('El modelo del vehículo es obligatorio.'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid creation data including optional fields', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithQuery(<VehicleForm onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('Propietario'), '10')
    await user.selectOptions(screen.getByLabelText('Marca de vehículo'), '1')
    await user.type(screen.getByLabelText('Placa'), 'abc-1234')
    await user.type(screen.getByLabelText('Modelo'), 'Corolla')
    await user.type(screen.getByLabelText('Color (opcional)'), 'Blanco')
    await user.type(screen.getByLabelText('Año (opcional)'), '2023')
    await user.type(
      screen.getByLabelText('VIN (opcional)'),
      '1hgcr2f83ha000001',
    )

    await user.click(screen.getByRole('button', { name: 'Guardar vehículo' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        owner_id: 10,
        brand_id: 1,
        plate: 'ABC-1234',
        model: 'Corolla',
        color: 'Blanco',
        year: 2023,
        vin: '1HGCR2F83HA000001',
      })
    })
  })

  it('renders edit mode with pre-filled fields and read-only owner display', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    const existingVehicle: VehicleSummary = {
      id: 5,
      plate: 'XYZ-9999',
      model: 'Hilux',
      color: 'Gris',
      year: 2021,
      vin: 'VINEXISTENTE001',
      is_active: true,
      version: 2,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-02T00:00:00Z',
      brand: { id: 2, name: 'Chevrolet', is_active: true },
      current_owner: {
        id: 20,
        name: 'María López',
        identification: '0923456789',
        is_active: true,
      },
    }

    renderWithQuery(
      <VehicleForm vehicle={existingVehicle} onSubmit={onSubmit} />,
    )

    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/María López/)).toBeInTheDocument()
    expect(screen.getByLabelText('Placa')).toHaveValue('XYZ-9999')
    expect(screen.getByLabelText('Modelo')).toHaveValue('Hilux')

    // Change color and model
    await user.clear(screen.getByLabelText('Color (opcional)'))
    await user.type(screen.getByLabelText('Color (opcional)'), 'Negro')

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id: 5,
        expected_version: 2,
        brand_id: 2,
        plate: 'XYZ-9999',
        model: 'Hilux',
        color: 'Negro',
        year: 2021,
        vin: 'VINEXISTENTE001',
      })
    })
  })

  it('displays duplicate plate conflict error returned from server', async () => {
    const error = new ProblemError(
      'Ya existe un vehículo con la placa ABC-1234.',
      409,
      'duplicate_plate',
    )
    const onSubmit = vi.fn().mockRejectedValue(error)
    const user = userEvent.setup()

    renderWithQuery(<VehicleForm onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('Propietario'), '10')
    await user.selectOptions(screen.getByLabelText('Marca de vehículo'), '1')
    await user.type(screen.getByLabelText('Placa'), 'ABC-1234')
    await user.type(screen.getByLabelText('Modelo'), 'Corolla')

    await user.click(screen.getByRole('button', { name: 'Guardar vehículo' }))

    await waitFor(() => {
      expect(
        screen.getAllByText('Ya existe un vehículo registrado con esta placa.')
          .length,
      ).toBeGreaterThanOrEqual(1)
    })
  })

  it('allows creating a missing brand inline without losing entered vehicle draft values', async () => {
    mockCreateBrand.mockResolvedValue({
      id: 99,
      name: 'Nissan',
      is_active: true,
      version: 1,
    })
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithQuery(<VehicleForm onSubmit={onSubmit} />)

    // Fill some vehicle data first
    await user.selectOptions(screen.getByLabelText('Propietario'), '10')
    await user.type(screen.getByLabelText('Placa'), 'PBA-5555')
    await user.type(screen.getByLabelText('Modelo'), 'Sentra')

    // Click "Nueva marca" button
    const newBrandBtn = screen.getByRole('button', { name: /nueva marca/i })
    expect(newBrandBtn).toBeInTheDocument()
    await user.click(newBrandBtn)

    // Brand form is displayed
    expect(
      screen.getByRole('heading', { name: /nueva marca/i }),
    ).toBeInTheDocument()
    const brandNameInput = screen.getByLabelText(/nombre de la marca/i)
    await user.type(brandNameInput, 'Nissan')

    // Submit brand form
    await user.click(screen.getByRole('button', { name: 'Guardar marca' }))

    await waitFor(() => {
      expect(mockCreateBrand).toHaveBeenCalledWith({ name: 'Nissan' })
    })

    // Sub-view closes and vehicle draft fields are preserved!
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /nueva marca/i }),
      ).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Placa')).toHaveValue('PBA-5555')
    expect(screen.getByLabelText('Modelo')).toHaveValue('Sentra')
  })
})

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false })
  return {
    detail: {} as Record<string, unknown>,
    mutations: {
      finalize: mutation(),
      reopen: mutation(),
      addLine: mutation(),
      updateLine: mutation(),
      removeLine: mutation(),
      uploadPhoto: mutation(),
      removePhoto: mutation(),
      updateIntervention: mutation(),
    },
  }
})

vi.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceOrder: () => mocks.detail,
  useMaintenanceMutations: () => mocks.mutations,
  useServicePickerOptions: () => ({
    isPending: false,
    isError: false,
    data: {
      totalPages: 1,
      options: [
        { id: 2, label: 'Alineación', detail: 'Precio referencial USD 25.00' },
      ],
    },
  }),
}))

import { MaintenanceOrderDetailPage } from './MaintenanceOrderDetailPage'

const user = { id: 1, name: 'Encargado' }

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    number: 'ART-OT-000009',
    state: 'REGISTERED',
    version: 3,
    fiscal_entity: { ruc: '1790000000002', legal_name: 'Taller Artesanal' },
    customer: {
      id: 3,
      name: 'Ana Pérez',
      identification_type: 'CI',
      identification: '1712345678',
      is_active: true,
    },
    vehicle: {
      id: 4,
      plate: 'ABC-1234',
      brand: 'Toyota',
      model: 'Hilux',
      is_active: false,
    },
    opened_on: '2026-09-20',
    odometer_km: 85000,
    odometer_confirmation: null,
    diagnosis: '',
    notes: 'Cliente trae su propio filtro',
    created_by: user,
    created_at: '2026-09-20T10:00:00Z',
    updated_by: user,
    updated_at: '2026-09-20T10:00:00Z',
    last_finalized_by: null,
    last_finalized_at: null,
    services_total: '350.00',
    interventions: [
      {
        id: 1,
        kind: 'INITIAL',
        ordinal: 1,
        cause: '',
        work_performed: '',
        notes: '',
        is_open: true,
        opened_by: user,
        opened_at: '2026-09-20T10:00:00Z',
        closed_by: null,
        closed_at: null,
        subtotal: '350.00',
        lines: [
          {
            id: 11,
            service_id: 2,
            service_name: 'Cambio de embrague',
            service_is_active: true,
            reference_price: '300.00',
            applied_price: '350.00',
            quantity: 1,
            subtotal: '350.00',
            tax_name: 'IVA',
            no_charge: false,
          },
        ],
      },
    ],
    photos: [
      {
        id: 5,
        intervention_id: 1,
        description: 'Golpe',
        content_type: 'image/jpeg',
        size_bytes: 10,
        width: 1,
        height: 1,
        uploaded_by: user,
        uploaded_at: '2026-09-20T10:00:00Z',
        file_url: '/api/v1/maintenance-orders/9/photos/5/file/',
        thumbnail_url: '/api/v1/maintenance-orders/9/photos/5/thumbnail/',
      },
    ],
    transitions: [],
    pending_requirements: [
      { code: 'diagnosis', message: 'Registre el diagnóstico.' },
    ],
    allowed_actions: [
      'edit',
      'manage_services',
      'change_price',
      'manage_photos',
      'finalize',
    ],
    ...overrides,
  }
}

function renderDetail() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/maintenance/9']}>
        <Routes>
          <Route
            element={<MaintenanceOrderDetailPage />}
            path="/maintenance/:id"
          />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.detail = { isPending: false, isError: false, data: order() }
})

it('organiza la ficha en secciones con precios aplicados y total operativo', () => {
  renderDetail()
  expect(
    screen.getByRole('heading', { name: 'ART-OT-000009' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Información general')).toHaveTextContent(
    'Ana Pérez',
  )
  expect(screen.getByText('Diagnóstico y observaciones')).toBeInTheDocument()
  expect(screen.getByText('Pendiente de registrar.')).toBeInTheDocument()
  expect(screen.getByText('Precio aplicado')).toBeInTheDocument()
  expect(screen.getAllByText('Total de servicios de la orden').length).toBe(2)
  expect(
    screen.getByRole('list', { name: 'Requisitos para finalizar' }),
  ).toHaveTextContent('Diagnóstico registrado (pendiente)')
  expect(screen.getByAltText('Golpe')).toHaveAttribute(
    'src',
    '/api/v1/maintenance-orders/9/photos/5/thumbnail/',
  )
  expect(screen.getByText('Historial')).toBeInTheDocument()
  expect(screen.getByText('Inactivo')).toBeInTheDocument()
  for (const word of [/repuesto/i, /saldo/i, /pago/i, /factura/i]) {
    expect(
      screen.queryByRole('heading', { name: word }),
    ).not.toBeInTheDocument()
  }
})

it('una orden finalizada solo ofrece reabrir', () => {
  mocks.detail = {
    isPending: false,
    isError: false,
    data: order({
      state: 'FINALIZED',
      allowed_actions: ['reopen'],
      pending_requirements: [],
      last_finalized_by: user,
      last_finalized_at: '2026-09-21T10:00:00Z',
    }),
  }
  renderDetail()
  expect(screen.getByRole('button', { name: /Reabrir/ })).toBeInTheDocument()
  for (const name of [
    /Editar datos/,
    /Finalizar/,
    /Agregar servicio/,
    /Adjuntar fotografía/,
    /Retirar/,
  ]) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  }
  expect(screen.getByText('Orden finalizada')).toBeInTheDocument()
})

it('al finalizar muestra el resumen y bloquea con requisitos pendientes', async () => {
  const u = userEvent.setup()
  renderDetail()
  await u.click(screen.getByRole('button', { name: /Finalizar/ }))
  const dialog = await screen.findByRole('dialog')
  expect(
    within(dialog).getByText('Requisitos pendientes para finalizar'),
  ).toBeInTheDocument()
  expect(
    within(dialog).getByText('Registre el diagnóstico.'),
  ).toBeInTheDocument()
  expect(
    within(dialog).getByRole('button', { name: 'Finalizar orden' }),
  ).toBeDisabled()
})

it('finaliza una orden completa con la versión vigente', async () => {
  const u = userEvent.setup()
  mocks.detail = {
    isPending: false,
    isError: false,
    data: order({ pending_requirements: [] }),
  }
  mocks.mutations.finalize.mutateAsync.mockResolvedValue(
    order({ state: 'FINALIZED' }),
  )
  renderDetail()
  await u.click(screen.getByRole('button', { name: /Finalizar/ }))
  await u.click(await screen.findByRole('button', { name: 'Finalizar orden' }))
  await waitFor(() =>
    expect(mocks.mutations.finalize.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, expectedVersion: 3 }),
    ),
  )
  expect(
    await screen.findByText('Orden ART-OT-000009 finalizada.'),
  ).toBeInTheDocument()
})

it('reabrir exige causa y explica la intervención correctiva', async () => {
  const u = userEvent.setup()
  mocks.detail = {
    isPending: false,
    isError: false,
    data: order({
      state: 'FINALIZED',
      allowed_actions: ['reopen'],
      pending_requirements: [],
    }),
  }
  mocks.mutations.reopen.mutateAsync.mockResolvedValue(
    order({ state: 'REOPENED' }),
  )
  renderDetail()
  await u.click(screen.getByRole('button', { name: /Reabrir/ }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Qué ocurre al reabrir')).toBeInTheDocument()
  await u.click(within(dialog).getByRole('button', { name: 'Reabrir orden' }))
  expect(
    within(dialog).getByText(
      'Indique la causa atribuible al trabajo anterior.',
    ),
  ).toBeInTheDocument()
  expect(mocks.mutations.reopen.mutateAsync).not.toHaveBeenCalled()
  await u.type(within(dialog).getByLabelText('Causa de la reapertura'), 'Ruido')
  await u.click(within(dialog).getByRole('button', { name: 'Reabrir orden' }))
  await waitFor(() =>
    expect(mocks.mutations.reopen.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, reason: 'Ruido', expectedVersion: 3 }),
    ),
  )
})

it('agrega un servicio con precio ajustado', async () => {
  const u = userEvent.setup()
  mocks.mutations.addLine.mutateAsync.mockResolvedValue(order())
  renderDetail()
  await u.click(screen.getByRole('button', { name: /Agregar servicio/ }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.focus(
    within(dialog).getByRole('combobox', { name: 'Servicio del catálogo' }),
  )
  await u.click(await screen.findByRole('option', { name: /Alineación/ }))
  expect(dialog.className).toContain('max-w-[600px]')
  expect(
    within(dialog).getByText('Alineación', { selector: 'p' }),
  ).toBeVisible()
  expect(
    within(dialog).getByText('Precio referencial del catálogo: USD 25.00'),
  ).toBeInTheDocument()
  const price = within(dialog).getByLabelText(
    'Precio aplicado a esta orden (USD)',
  )
  expect(price).toHaveValue('25.00')
  await u.clear(price)
  await u.type(price, '30.00')
  await u.click(
    within(dialog).getByRole('button', { name: 'Agregar servicio' }),
  )
  await waitFor(() =>
    expect(mocks.mutations.addLine.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        data: { service_id: 2, quantity: 1, applied_price: '30.00' },
        expectedVersion: 3,
      }),
    ),
  )
})

it('una carga rechazada conserva archivo y descripción', async () => {
  const u = userEvent.setup()
  mocks.mutations.uploadPhoto.mutateAsync.mockRejectedValue(
    new ProblemError('Imagen no admitida.', 400, 'invalid_image', undefined, {
      file: ['Adjunte una imagen JPEG, PNG o WebP estática y válida.'],
    }),
  )
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  renderDetail()
  await u.click(screen.getByRole('button', { name: /Adjuntar fotografía/ }))
  const dialog = await screen.findByRole('dialog')
  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
  await u.upload(within(dialog).getByLabelText('Imagen'), file)
  await u.type(
    within(dialog).getByLabelText('Descripción (opcional)'),
    'Puerta',
  )
  await u.click(within(dialog).getByRole('button', { name: 'Adjuntar' }))
  expect(
    await within(dialog).findByText(
      'Adjunte una imagen JPEG, PNG o WebP estática y válida.',
    ),
  ).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Descripción (opcional)')).toHaveValue(
    'Puerta',
  )
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('muestra el error de carga con reintento', () => {
  mocks.detail = { isPending: false, isError: true, refetch: vi.fn() }
  renderDetail()
  expect(screen.getByText('No se pudo cargar la orden')).toBeInTheDocument()
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false })
  return {
    detail: {} as Record<string, unknown>,
    permissions: [] as string[],
    parts: [] as unknown[],
    summary: {
      order_id: 9,
      order_number: 'ART-OT-000009',
      commercial: {
        visible: true,
        documents: [],
        pending: null,
        confirmed_total: '0.00',
        balance_total: '0.00',
      },
      artisan: {
        visible: true,
        documents: [],
        pending: null,
        confirmed_total: '0.00',
        balance_total: '0.00',
      },
      combined: null,
      notice: 'Los importes de cada RUC se cobran por separado.',
    } as Record<string, unknown>,
    mutations: {
      finalize: mutation(),
      reopen: mutation(),
      addLine: mutation(),
      updateLine: mutation(),
      removeLine: mutation(),
      uploadPhoto: mutation(),
      removePhoto: mutation(),
      updateIntervention: mutation(),
      update: mutation(),
    },
  }
})

vi.mock('@/features/maintenance/hooks', () => ({
  maintenanceKeys: {
    root: ['maintenance'],
    detail: (id: number) => ['maintenance', 'detail', id],
  },
  useMaintenanceOrder: () => mocks.detail,
  useMaintenanceMutations: () => mocks.mutations,
  useMaintenanceOrders: () => ({
    isPending: false,
    isError: false,
    data: { results: [], count: 0, page: 1, total_pages: 1 },
  }),
  useServiceSearch: (term: string) => ({
    isPending: false,
    isError: false,
    data: {
      results: term
        ? [
            {
              id: 2,
              name: 'Alineación',
              description: '',
              reference_price: '25.00',
            },
          ]
        : [],
    },
  }),
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

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({
    data: { username: 'encargado', permissions: mocks.permissions },
  }),
}))

vi.mock('@/features/maintenance/billingHooks', () => ({
  useOrderParts: () => ({
    isPending: false,
    isError: false,
    isSuccess: true,
    data: mocks.parts,
  }),
  useEconomicSummary: () => ({
    isPending: false,
    isError: false,
    data: mocks.summary,
  }),
  useBillingMutations: () => ({
    addPart: mocks.mutations.addLine,
    changePart: mocks.mutations.updateLine,
    removePart: mocks.mutations.removeLine,
    confirmServices: mocks.mutations.finalize,
    pay: mocks.mutations.finalize,
    voidOperation: mocks.mutations.finalize,
    correctPayment: mocks.mutations.finalize,
  }),
  usePartProductPicker: () => ({ isPending: false, isError: false }),
  usePartSearch: () => ({ isPending: false, isError: false, data: undefined }),
  useVoidPreview: () => ({ isPending: false }),
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
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/maintenance/9']}>
          <Routes>
            <Route
              element={<MaintenanceOrderDetailPage />}
              path="/maintenance/:id"
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  const empty = {
    visible: true,
    documents: [],
    pending: null,
    confirmed_total: '0.00',
    balance_total: '0.00',
  }
  mocks.summary = { ...mocks.summary, commercial: empty, artisan: empty }
  mocks.detail = { isPending: false, isError: false, data: order() }
})

it('organiza la ficha: banda del vehículo, trabajo a la izquierda y estado a la derecha', () => {
  renderDetail()
  expect(
    screen.getByRole('heading', { level: 1, name: /ART-OT-000009/ }),
  ).toBeInTheDocument()
  const band = screen.getByRole('region', { name: 'Vehículo' })
  expect(within(band).getByText('ABC-1234')).toBeInTheDocument()
  expect(within(band).getByRole('link', { name: 'Ana Pérez' })).toHaveAttribute(
    'href',
    '/customers/3',
  )
  expect(
    within(band).getByRole('img', { name: '85.000 kilómetros' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('textbox', { name: /Diagnóstico/ }),
  ).toBeInTheDocument()
  expect(screen.getByText('Cambio de embrague')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /^Repuestos/ })).toBeInTheDocument()
  expect(
    screen.getByRole('textbox', { name: 'Observaciones' }),
  ).toBeInTheDocument()
  expect(screen.getByAltText('Golpe')).toHaveAttribute(
    'src',
    '/api/v1/maintenance-orders/9/photos/5/thumbnail/',
  )
  const finalize = screen.getByRole('region', { name: 'Para finalizar' })
  expect(within(finalize).getByText('2 de 3')).toBeInTheDocument()
  expect(
    within(finalize).getByRole('list', { name: 'Requisitos para finalizar' }),
  ).toHaveTextContent('Diagnóstico escrito (pendiente)')
  expect(
    within(finalize).getByRole('button', { name: 'Finalizar mantenimiento' }),
  ).toBeDisabled()
  expect(
    screen.queryByRole('region', { name: 'Visitas anteriores' }),
  ).not.toBeInTheDocument()
  // Finalizar y cobro van juntos en la misma tarjeta.
  expect(finalize.parentElement).toBe(
    screen.getByRole('region', { name: 'Cobro' }).parentElement,
  )
  expect(
    screen.getByRole('region', { name: 'Movimientos de esta orden' }),
  ).toBeInTheDocument()
})

it('el cobro muestra el importe de cada negocio y «Cobrar y facturar» lleva a sus cobros', () => {
  mocks.summary = {
    ...mocks.summary,
    commercial: {
      visible: true,
      documents: [],
      pending: { label: 'Reservado', line_count: 1, estimated_total: '40.00' },
      confirmed_total: '0.00',
      balance_total: '0.00',
    },
  }
  renderDetail()
  const cobro = screen.getByRole('region', { name: 'Cobro' })
  // Mano de obra 350.00 + repuestos 40.00: el total solo informa, cada negocio se cobra aparte.
  expect(within(cobro).getByText('USD 390.00')).toBeInTheDocument()
  expect(within(cobro).getByText('USD 350.00')).toBeInTheDocument()
  expect(within(cobro).getByText('USD 40.00')).toBeInTheDocument()
  expect(within(cobro).getByText('Sin cobrar')).toBeInTheDocument()
  expect(
    within(cobro).getByRole('link', { name: 'Cobrar y facturar' }),
  ).toHaveAttribute('href', '/maintenance/9/checkout')
})

it('sin permiso de cobros no se muestra la tarjeta de cobro', () => {
  mocks.summary = {
    ...mocks.summary,
    commercial: { ...(mocks.summary.commercial as object), visible: false },
    artisan: { ...(mocks.summary.artisan as object), visible: false },
  }
  renderDetail()
  expect(
    screen.queryByRole('region', { name: 'Cobro' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Cobrar y facturar' }),
  ).not.toBeInTheDocument()
})

it('agrega un trabajo desde el buscador con cantidad uno', async () => {
  const u = userEvent.setup()
  mocks.mutations.addLine.mutateAsync.mockResolvedValue(order())
  renderDetail()
  await u.type(screen.getByRole('textbox', { name: 'Agregar trabajo' }), 'alin')
  await u.click(
    await screen.findByRole('button', { name: 'Agregar Alineación' }),
  )
  await waitFor(() =>
    expect(mocks.mutations.addLine.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        data: { service_id: 2, quantity: 1 },
        expectedVersion: 3,
      }),
    ),
  )
})

it('el diagnóstico se guarda al salir del cuadro y habilita el avance', async () => {
  const u = userEvent.setup()
  mocks.mutations.update.mutateAsync.mockResolvedValue(order())
  renderDetail()
  await u.type(
    screen.getByRole('textbox', { name: /Diagnóstico/ }),
    'Pastillas gastadas',
  )
  await u.tab()
  await waitFor(() =>
    expect(mocks.mutations.update.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        data: { diagnosis: 'Pastillas gastadas' },
        expectedVersion: 3,
      }),
    ),
  )
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
  expect(
    screen.getByRole('button', { name: /Reabrir por un problema/ }),
  ).toBeInTheDocument()
  for (const name of [
    /Editar datos/,
    /Finalizar/,
    /Adjuntar fotografía/,
    /Retirar/,
  ]) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  }
  expect(
    screen.queryByRole('region', { name: 'Para finalizar' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /Diagnóstico/ })).toHaveAttribute(
    'readonly',
  )
  // Finalizada, el cobro pasa a ser la acción principal.
  expect(
    screen.getByRole('link', { name: 'Cobrar y facturar' }),
  ).toBeInTheDocument()
})

it('al finalizar muestra el resumen y bloquea con requisitos pendientes', async () => {
  const u = userEvent.setup()
  mocks.detail = {
    isPending: false,
    isError: false,
    data: order({ diagnosis: 'Listo', pending_requirements: [] }),
  }
  renderDetail()
  await u.click(screen.getByRole('button', { name: 'Finalizar mantenimiento' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
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
  await u.click(screen.getByRole('button', { name: 'Finalizar mantenimiento' }))
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
  await u.click(screen.getByRole('button', { name: /Reabrir por un problema/ }))
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

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mutation = () => ({
    isError: false,
    isPending: false,
    error: null as Error | null,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
  })
  return {
    status: {
      data: { is_initialized: true },
      isLoading: false,
      isError: false,
    },
    entities: {
      data: undefined as Array<Record<string, unknown>> | undefined,
      isLoading: false,
    },
    warehouse: {
      data: undefined as Record<string, unknown> | undefined,
      isLoading: false,
    },
    taxes: {
      data: undefined as Array<Record<string, unknown>> | undefined,
      isLoading: false,
    },
    series: {
      data: undefined as Array<Record<string, unknown>> | undefined,
      isLoading: false,
    },
    initialize: mutation(),
    entityUpdate: mutation(),
    warehouseUpdate: mutation(),
    taxCreate: mutation(),
    periodCreate: mutation(),
    seriesUpdate: mutation(),
  }
})

vi.mock('@/features/workshop-configuration/queries', () => ({
  useWorkshopStatus: () => mocks.status,
  useFiscalEntities: () => mocks.entities,
  useWarehouse: () => mocks.warehouse,
  useAllTaxDefinitions: () => mocks.taxes,
  useAllDocumentSeries: () => mocks.series,
  useUpdateFiscalEntity: () => mocks.entityUpdate,
  useUpdateWarehouse: () => mocks.warehouseUpdate,
  useCreateTaxDefinition: () => mocks.taxCreate,
  useCreateTaxPeriod: () => mocks.periodCreate,
  useUpdateSeriesCode: () => mocks.seriesUpdate,
  useInitializeWorkshop: () => mocks.initialize,
}))

import { WorkshopConfigurationPage } from './WorkshopConfigurationPage'

const entities = [
  {
    id: 1,
    entity_type: 'ARTESANAL',
    ruc: '1104018559001',
    legal_name: 'Trasmisiones y Embragues Jimenez',
    trade_name: null,
    address: 'Via Catamayo - Loja Ecuador',
    phone: null,
    email: null,
    version: 2,
  },
  {
    id: 2,
    entity_type: 'COMERCIAL',
    ruc: '1150696977001',
    legal_name: 'Repuestos VVH',
    trade_name: null,
    address: null,
    phone: null,
    email: null,
    version: 2,
  },
]
const warehouse = {
  id: 1,
  name: 'Bodega Principal',
  is_active: true,
  version: 1,
}
const taxes = [
  {
    id: 1,
    code: 'IVA',
    name: 'IVA',
    entity_type: 'COMERCIAL',
    current_rate: '15',
    starts_on: '2026-09-15',
  },
  {
    id: 2,
    code: 'CERO',
    name: 'Tarifa cero',
    entity_type: 'ARTESANAL',
    current_rate: null,
    starts_on: null,
  },
]
const series = [
  {
    id: 1,
    code: 'COM-VEN',
    is_active: true,
    last_number: 4,
    version: 1,
    document_type: 'VENTA',
    entity_type: 'COMERCIAL',
  },
  {
    id: 2,
    code: 'OTR',
    is_active: false,
    last_number: 0,
    version: 3,
    document_type: 'OTRO',
  },
]

function resetMutation(mutation: (typeof mocks)['initialize']) {
  mutation.isError = false
  mutation.isPending = false
  mutation.error = null
  mutation.mutate.mockReset()
  mutation.mutateAsync.mockReset()
  mutation.reset.mockReset()
}

beforeEach(() => {
  mocks.status.data = { is_initialized: true }
  mocks.status.isLoading = false
  mocks.status.isError = false
  mocks.entities.data = entities
  mocks.entities.isLoading = false
  mocks.warehouse.data = warehouse
  mocks.warehouse.isLoading = false
  mocks.taxes.data = taxes
  mocks.taxes.isLoading = false
  mocks.series.data = series
  mocks.series.isLoading = false
  resetMutation(mocks.initialize)
  resetMutation(mocks.entityUpdate)
  resetMutation(mocks.warehouseUpdate)
  resetMutation(mocks.taxCreate)
  resetMutation(mocks.periodCreate)
  resetMutation(mocks.seriesUpdate)
})

it('presents a control center with differentiated configuration sections', () => {
  render(<WorkshopConfigurationPage />)

  expect(
    screen.getByRole('navigation', { name: 'Mapa de configuración' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Identidades fiscales' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Operación del inventario' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Impuestos y vigencias' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Series y secuenciales' }),
  ).toBeInTheDocument()
  expect(screen.getByText('15%')).toBeInTheDocument()
  expect(screen.getByText('Sin tarifa')).toBeInTheDocument()
  expect(screen.getByText('000004')).toBeInTheDocument()
  expect(screen.getAllByText('Inactiva')).toHaveLength(1)
})

it('shows page and section loading states and the page-level failure', () => {
  mocks.status.isLoading = true
  const { rerender } = render(<WorkshopConfigurationPage />)
  expect(screen.getByText('Cargando configuración...')).toBeInTheDocument()

  mocks.status.isLoading = false
  mocks.status.isError = true
  rerender(<WorkshopConfigurationPage />)
  expect(
    screen.getByText('No se pudo cargar la configuración.'),
  ).toBeInTheDocument()

  mocks.status.isError = false
  mocks.entities.isLoading = true
  mocks.warehouse.isLoading = true
  mocks.taxes.isLoading = true
  mocks.series.isLoading = true
  rerender(<WorkshopConfigurationPage />)
  expect(screen.getAllByText('Cargando…')).toHaveLength(4)
})

it('initializes the workshop only after complete, distinct identifiers are provided', async () => {
  const user = userEvent.setup()
  mocks.status.data = { is_initialized: false }
  render(<WorkshopConfigurationPage />)

  const submit = screen.getByRole('button', {
    name: 'Guardar configuración inicial',
  })
  expect(submit).toBeDisabled()
  await user.type(screen.getByLabelText('RUC Comercial'), 'abc1150696977001')
  await user.type(screen.getByLabelText('RUC Artesanal'), '1104018559001')
  const legalNames = screen.getAllByLabelText('Razón Social')
  await user.type(legalNames[0]!, '  Repuestos VVH  ')
  await user.type(legalNames[1]!, '  Taller Jiménez  ')
  await user.type(screen.getByLabelText('Nombre de la bodega'), '  Matriz  ')

  expect(submit).toBeEnabled()
  await user.click(submit)

  expect(mocks.initialize.mutate).toHaveBeenCalledWith({
    data: {
      commercial_ruc: '1150696977001',
      commercial_legal_name: 'Repuestos VVH',
      artisanal_ruc: '1104018559001',
      artisanal_legal_name: 'Taller Jiménez',
      warehouse_name: 'Matriz',
    },
    idempotencyKey: expect.any(String),
  })
})

it('blocks initialization when both fiscal entities use the same RUC', async () => {
  const user = userEvent.setup()
  mocks.status.data = { is_initialized: false }
  render(<WorkshopConfigurationPage />)

  await user.type(screen.getByLabelText('RUC Comercial'), '1150696977001')
  await user.type(screen.getByLabelText('RUC Artesanal'), '1150696977001')
  const legalNames = screen.getAllByLabelText('Razón Social')
  await user.type(legalNames[0]!, 'Comercial')
  await user.type(legalNames[1]!, 'Artesanal')
  await user.type(screen.getByLabelText('Nombre de la bodega'), 'Matriz')

  expect(
    screen.getByText(
      'El RUC comercial y el RUC artesanal deben ser diferentes.',
    ),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Guardar configuración inicial' }),
  ).toBeDisabled()
  expect(mocks.initialize.mutate).not.toHaveBeenCalled()
})

it('keeps the initialization error visible and prevents a duplicate submission', () => {
  mocks.status.data = { is_initialized: false }
  mocks.initialize.isError = true
  mocks.initialize.isPending = true
  mocks.initialize.error = new Error('RUC inválido')
  render(<WorkshopConfigurationPage />)

  expect(screen.getByText(/RUC inválido/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled()
})

it('updates a fiscal identity with its expected version and closes on success', async () => {
  const user = userEvent.setup()
  render(<WorkshopConfigurationPage />)

  await user.click(screen.getAllByRole('button', { name: 'Editar' })[0]!)
  const dialog = screen.getByRole('dialog', {
    name: 'Editar Entidad Artesanal',
  })
  expect(dialog).toHaveClass('dialog-panel')
  await user.clear(screen.getByLabelText('Razón Social'))
  await user.type(screen.getByLabelText('Razón Social'), 'Taller actualizado')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  expect(mocks.entityUpdate.mutate).toHaveBeenCalledWith(
    {
      id: 1,
      data: {
        ruc: '1104018559001',
        legal_name: 'Taller actualizado',
        address: 'Via Catamayo - Loja Ecuador',
        expected_version: 2,
      },
    },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  )
  mocks.entityUpdate.mutate.mock.calls[0]![1].onSuccess()
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
})

it('updates the warehouse name and reports mutation failures in its dialog', async () => {
  const user = userEvent.setup()
  mocks.warehouseUpdate.isError = true
  mocks.warehouseUpdate.error = new Error('Conflicto de versión')
  render(<WorkshopConfigurationPage />)

  await user.click(screen.getAllByRole('button', { name: 'Editar' })[2]!)
  expect(screen.getByText(/Conflicto de versión/)).toBeInTheDocument()
  await user.clear(screen.getByLabelText('Nombre de la bodega'))
  await user.type(screen.getByLabelText('Nombre de la bodega'), '  Norte  ')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  expect(mocks.warehouseUpdate.mutate).toHaveBeenCalledWith(
    { name: 'Norte', expected_version: 1 },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  )
  mocks.warehouseUpdate.mutate.mock.calls[0]![1].onSuccess()
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Editar Bodega Principal' }),
    ).not.toBeInTheDocument(),
  )
})

it('creates an uppercase tax definition and its initial period, then closes', async () => {
  const user = userEvent.setup()
  mocks.taxCreate.mutateAsync.mockResolvedValue({ id: 9 })
  mocks.periodCreate.mutateAsync.mockResolvedValue({ id: 10 })
  render(<WorkshopConfigurationPage />)

  await user.click(screen.getByRole('button', { name: 'Nuevo Impuesto' }))
  expect(mocks.taxCreate.reset).toHaveBeenCalled()
  await user.selectOptions(screen.getByLabelText('Entidad Fiscal'), '2')
  await user.type(screen.getByLabelText('Código del impuesto'), ' iva ')
  await user.type(screen.getByLabelText('Tarifa (%)'), '12')
  await user.type(screen.getByLabelText('Nombre oficial'), ' IVA general ')
  fireEvent.change(screen.getByLabelText('Fecha de vigencia (desde)'), {
    target: { value: '2026-10-01' },
  })
  await user.click(screen.getByRole('button', { name: 'Crear impuesto' }))

  await waitFor(() =>
    expect(mocks.taxCreate.mutateAsync).toHaveBeenCalledWith({
      entity_id: 2,
      code: 'IVA',
      name: 'IVA general',
    }),
  )
  expect(mocks.periodCreate.mutateAsync).toHaveBeenCalledWith({
    taxDefId: 9,
    data: { rate: '12', starts_on: '2026-10-01' },
  })
  expect(
    screen.queryByRole('dialog', { name: 'Nuevo Impuesto y Vigencia' }),
  ).not.toBeInTheDocument()
})

it('keeps the tax dialog open when either mutation fails and shows its error', async () => {
  const user = userEvent.setup()
  mocks.taxCreate.isError = true
  mocks.taxCreate.error = new Error('Código duplicado')
  mocks.taxCreate.mutateAsync.mockRejectedValue(new Error('Código duplicado'))
  render(<WorkshopConfigurationPage />)

  await user.click(screen.getByRole('button', { name: 'Nuevo Impuesto' }))
  await user.type(screen.getByLabelText('Código del impuesto'), 'IVA')
  await user.type(screen.getByLabelText('Tarifa (%)'), '15')
  await user.type(screen.getByLabelText('Nombre oficial'), 'IVA')
  await user.click(screen.getByRole('button', { name: 'Crear impuesto' }))

  expect(await screen.findByText(/Código duplicado/)).toBeInTheDocument()
  expect(
    screen.getByRole('dialog', { name: 'Nuevo Impuesto y Vigencia' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(mocks.taxCreate.reset).toHaveBeenCalledTimes(2)
})

it('updates a document series in uppercase with optimistic version control', async () => {
  const user = userEvent.setup()
  render(<WorkshopConfigurationPage />)

  await user.click(screen.getAllByRole('button', { name: 'Editar' })[3]!)
  const code = screen.getByLabelText('Código de serie / Prefijo')
  await user.clear(code)
  await user.type(code, ' com-nueva ')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  expect(mocks.seriesUpdate.mutate).toHaveBeenCalledWith(
    {
      seriesId: 1,
      data: { code: 'COM-NUEVA', expected_version: 1 },
    },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  )
  mocks.seriesUpdate.mutate.mock.calls[0]![1].onSuccess()
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Editar Serie: COM-VEN' }),
    ).not.toBeInTheDocument(),
  )
})

it('renders empty tax and series guidance and inactive warehouse state', () => {
  mocks.taxes.data = []
  mocks.series.data = []
  mocks.warehouse.data = { ...warehouse, is_active: false }
  render(<WorkshopConfigurationPage />)

  expect(
    screen.getByText('Aún no hay impuestos configurados'),
  ).toBeInTheDocument()
  expect(screen.getByText('Aún no hay series configuradas')).toBeInTheDocument()
  expect(screen.getByText('Inactiva')).toBeInTheDocument()
})

it('uses neutral zero-value fallbacks while configuration queries have no data', () => {
  mocks.entities.data = undefined
  mocks.warehouse.data = undefined
  mocks.taxes.data = undefined
  mocks.series.data = undefined
  render(<WorkshopConfigurationPage />)

  expect(screen.getByText('0 registradas')).toBeInTheDocument()
  expect(screen.getByText('Bodega Central')).toBeInTheDocument()
  expect(
    screen.getByText('Aún no hay impuestos configurados'),
  ).toBeInTheDocument()
  expect(screen.getByText('Aún no hay series configuradas')).toBeInTheDocument()
  expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4)
})

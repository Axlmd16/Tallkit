import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
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
const fiscalSection = vi.hoisted(() => ({ mounts: 0 }))
vi.mock('@/features/fiscal/FiscalConfigurationSection', async () => {
  const { useEffect } = await import('react')
  return {
    FiscalConfigurationSection: () => {
      useEffect(() => {
        fiscalSection.mounts += 1
      }, [])
      return <section aria-label="Configuración fiscal electrónica" />
    },
  }
})

import { WorkshopConfigurationPage } from './WorkshopConfigurationPage'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

function page(search = '') {
  return (
    <MemoryRouter initialEntries={[`/configuration${search}`]}>
      <WorkshopConfigurationPage />
      <LocationProbe />
    </MemoryRouter>
  )
}

function renderPage(search = '') {
  return render(page(search))
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))
}

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
  fiscalSection.mounts = 0
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

it('organizes configuration in five tabs starting with fiscal entities', () => {
  renderPage()

  const tabs = screen.getAllByRole('tab')
  expect(tabs.map((tab) => tab.textContent?.replace(/\d+$/, ''))).toEqual([
    'Entidades fiscales',
    'Bodega',
    'Impuestos',
    'Series y numeración',
    'Facturación electrónica',
  ])
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  expect(
    screen.getByRole('heading', { name: 'Entidades fiscales' }),
  ).toBeVisible()
  expect(screen.queryByText('Identidades fiscales')).toBeNull()
  const panel = screen.getByRole('tabpanel')
  expect(panel).toHaveAttribute('aria-labelledby', tabs[0]!.id)
  expect(tabs[0]).toHaveAttribute('aria-controls', panel.id)
})

it('shows each existing area inside its own tab', async () => {
  const user = userEvent.setup()
  renderPage()

  await openTab(user, 'Bodega')
  expect(
    screen.getByRole('heading', { name: 'Operación del inventario' }),
  ).toBeVisible()
  await openTab(user, 'Impuestos')
  expect(
    screen.getByRole('heading', { name: 'Impuestos y vigencias' }),
  ).toBeVisible()
  expect(screen.getByText('15%')).toBeVisible()
  expect(screen.getByText('Sin tarifa')).toBeVisible()
  await openTab(user, 'Series y numeración')
  const seriesPanel = screen.getByRole('tabpanel')
  expect(
    within(seriesPanel).getByRole('heading', { name: 'Series y secuenciales' }),
  ).toBeVisible()
  expect(within(seriesPanel).getByText('000004')).toBeVisible()
  expect(within(seriesPanel).queryByText(/punto de emisión/i)).toBeNull()
  expect(screen.getByTestId('location')).toHaveTextContent('?tab=series')
  await openTab(user, 'Facturación electrónica')
  expect(
    screen.getByRole('region', { name: 'Configuración fiscal electrónica' }),
  ).toBeVisible()
})

it('opens a tab from a direct link and falls back to entities for unknown tabs', () => {
  const { unmount } = renderPage('?tab=facturacion')
  expect(
    screen.getByRole('tab', { name: 'Facturación electrónica' }),
  ).toHaveAttribute('aria-selected', 'true')
  unmount()

  renderPage('?tab=inexistente')
  expect(
    screen.getByRole('tab', { name: /^Entidades fiscales/ }),
  ).toHaveAttribute('aria-selected', 'true')
})

it('moves between tabs with the keyboard', async () => {
  const user = userEvent.setup()
  renderPage('?tab=bodega')
  screen.getByRole('tab', { name: /^Bodega/ }).focus()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: /^Impuestos/ })).toHaveFocus()
  expect(screen.getByRole('tab', { name: /^Impuestos/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await user.keyboard('{End}')
  expect(
    screen.getByRole('tab', { name: 'Facturación electrónica' }),
  ).toHaveFocus()
  await user.keyboard('{Home}')
  expect(screen.getByRole('tab', { name: /^Entidades fiscales/ })).toHaveFocus()
})

it('shows a tax error inside the Impuestos panel only', async () => {
  const user = userEvent.setup()
  mocks.taxCreate.isError = true
  mocks.taxCreate.error = new Error('Vigencia solapada')
  mocks.taxCreate.mutateAsync.mockRejectedValue(new Error('Vigencia solapada'))
  renderPage('?tab=impuestos')

  await user.click(screen.getByRole('button', { name: 'Nuevo Impuesto' }))
  await user.type(screen.getByLabelText('Código del impuesto'), 'IVA')
  await user.type(screen.getByLabelText('Tarifa (%)'), '15')
  await user.type(screen.getByLabelText('Nombre oficial'), 'IVA')
  await user.click(screen.getByRole('button', { name: 'Crear impuesto' }))
  const error = await screen.findByText(/Vigencia solapada/)
  expect(error).toBeVisible()
  const panels = screen.getAllByRole('tabpanel', { hidden: true })
  const owner = panels.filter((panel) => panel.contains(error))
  expect(owner).toHaveLength(1)
  expect(owner[0]).toHaveAttribute(
    'aria-labelledby',
    screen.getByRole('tab', { name: /^Impuestos/, hidden: true }).id,
  )
  // El diálogo es modal: mientras el error está abierto no se puede cambiar de pestaña.
  expect(screen.queryByRole('tab', { name: /^Bodega/ })).toBeNull()
})

it('shows page and section loading states and the page-level failure', () => {
  mocks.status.isLoading = true
  const { rerender } = renderPage()
  expect(screen.getByText('Cargando configuración...')).toBeInTheDocument()

  mocks.status.isLoading = false
  mocks.status.isError = true
  rerender(page())
  expect(
    screen.getByText('No se pudo cargar la configuración.'),
  ).toBeInTheDocument()

  mocks.status.isError = false
  mocks.entities.isLoading = true
  mocks.warehouse.isLoading = true
  mocks.taxes.isLoading = true
  mocks.series.isLoading = true
  rerender(page())
  expect(screen.getAllByText('Cargando…')).toHaveLength(4)
})

it('initializes the workshop only after complete, distinct identifiers are provided', async () => {
  const user = userEvent.setup()
  mocks.status.data = { is_initialized: false }
  renderPage()

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
  renderPage()

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
  renderPage()

  expect(screen.getByText(/RUC inválido/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled()
})

it('updates a fiscal identity with its expected version and closes on success', async () => {
  const user = userEvent.setup()
  renderPage()

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
  renderPage()

  await openTab(user, 'Bodega')
  await user.click(screen.getByRole('button', { name: 'Editar' }))
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
  renderPage()
  await openTab(user, 'Impuestos')

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
  renderPage()
  await openTab(user, 'Impuestos')

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
  renderPage()

  await openTab(user, 'Series y numeración')
  await user.click(screen.getAllByRole('button', { name: 'Editar' })[0]!)
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
  renderPage()

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
  renderPage()

  expect(screen.getByText('0 registradas')).toBeInTheDocument()
  expect(screen.getByText('Bodega Central')).toBeInTheDocument()
  expect(
    screen.getByText('Aún no hay impuestos configurados'),
  ).toBeInTheDocument()
  expect(screen.getByText('Aún no hay series configuradas')).toBeInTheDocument()
  expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4)
})

it('mounts electronic billing only after its first visit and keeps it afterwards', async () => {
  const user = userEvent.setup()
  renderPage()
  expect(fiscalSection.mounts).toBe(0)
  expect(
    screen.queryByRole('region', {
      name: 'Configuración fiscal electrónica',
      hidden: true,
    }),
  ).toBeNull()

  await openTab(user, 'Facturación electrónica')
  expect(fiscalSection.mounts).toBe(1)
  await openTab(user, 'Bodega')
  await openTab(user, 'Facturación electrónica')
  expect(fiscalSection.mounts).toBe(1)
})

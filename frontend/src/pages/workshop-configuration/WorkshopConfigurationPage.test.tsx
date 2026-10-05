import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type * as Readiness from '@/features/fiscal/configuration/readiness'
import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

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
      data: { is_initialized: true } as { is_initialized: boolean } | undefined,
      isLoading: false,
      isError: false,
    },
    entities: {
      data: undefined as Array<Record<string, unknown>> | undefined,
      isLoading: false,
      isError: false,
    },
    warehouse: {
      data: undefined as Record<string, unknown> | undefined,
      isLoading: false,
      isError: false,
    },
    taxes: {
      data: undefined as Array<Record<string, unknown>> | undefined,
      isLoading: false,
      isError: false,
    },
    series: {
      data: undefined as Array<Record<string, unknown>> | undefined,
      isLoading: false,
      isError: false,
    },
    initialize: mutation(),
    entityUpdate: mutation(),
    warehouseUpdate: mutation(),
    taxCreate: mutation(),
    periodCreate: mutation(),
    scheduleSuccessor: mutation(),
    periods: {} as Record<number, Array<Record<string, unknown>>>,
    seriesUpdate: mutation(),
    seriesReplace: mutation(),
    logoUpload: mutation(),
    logoRemove: mutation(),
    readiness: {
      isLoading: false,
      isError: false,
      pending: 0,
      firstDestination: null as {
        entityId: number
        section: string | null
      } | null,
      byEntity: {} as Record<number, unknown>,
    },
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
  useScheduleSuccessor: () => mocks.scheduleSuccessor,
  useTaxPeriods: (id: number) => ({
    data: mocks.periods[id],
    isLoading: false,
    isError: false,
  }),
  useUpdateSeriesCode: () => mocks.seriesUpdate,
  useReplaceSeries: () => mocks.seriesReplace,
  useInitializeWorkshop: () => mocks.initialize,
  useUploadEntityLogo: () => mocks.logoUpload,
  useRemoveEntityLogo: () => mocks.logoRemove,
}))
const fiscalSection = vi.hoisted(() => ({ mounts: 0 }))
vi.mock('@/features/fiscal/FiscalConfigurationSection', async () => {
  const { useEffect } = await import('react')
  return {
    FiscalConfigurationSection: () => {
      useEffect(() => {
        fiscalSection.mounts += 1
      }, [])
      return <p>Contenido de facturación electrónica</p>
    },
  }
})
vi.mock(
  '@/features/fiscal/configuration/readiness',
  async (importOriginal) => ({
    ...(await importOriginal<typeof Readiness>()),
    useConfigurationReadiness: () => mocks.readiness,
  }),
)

import { WorkshopConfigurationPage } from './WorkshopConfigurationPage'

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/configuration${search}`]}>
      <ToastProvider>
        <WorkshopConfigurationPage />
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  )
}

function sections() {
  return screen.getByRole('navigation', { name: 'Secciones de configuración' })
}

function sectionLink(name: string) {
  return within(sections()).getByRole('link', { name: new RegExp(`^${name}`) })
}

const entities = [
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
    logo: {
      url: '/api/v1/workshop-configuration/entity-logos/COMERCIAL/1/',
      revision: 1,
      content_type: 'image/png',
      width: 2000,
      height: 200,
      size_bytes: 1200,
      uploaded_at: '2026-09-27T10:00:00Z',
    },
  },
  {
    id: 1,
    entity_type: 'ARTESANAL',
    ruc: '1104018559001',
    legal_name: 'Trasmisiones y Embragues Jimenez',
    trade_name: 'TEJ',
    address: 'Vía Catamayo',
    phone: null,
    email: null,
    version: 3,
    logo: null,
  },
]
const warehouse = {
  id: 1,
  name: 'Bodega principal',
  is_active: true,
  version: 1,
}
const taxes = [
  {
    id: 1,
    code: 'IVA',
    name: 'IVA',
    fiscal_entity_id: 2,
    entity_type: 'COMERCIAL',
    current_rate: '15',
    starts_on: '2026-09-15',
    ends_on: null,
  },
  {
    id: 2,
    code: 'CERO',
    name: 'Tarifa cero',
    fiscal_entity_id: 1,
    entity_type: 'ARTESANAL',
    current_rate: null,
    starts_on: null,
    ends_on: null,
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
    code: 'COM-PRO',
    is_active: true,
    last_number: 0,
    version: 1,
    document_type: 'PROFORMA',
    entity_type: 'COMERCIAL',
  },
  {
    id: 3,
    code: 'ART-SER',
    is_active: true,
    last_number: 0,
    version: 1,
    document_type: 'SERVICIO',
    entity_type: 'ARTESANAL',
  },
]

function readySummary(entityId: number) {
  return {
    entityId,
    state: 'READY',
    pending: 0,
    causes: [],
    bySection: {
      perfil: [],
      puntos: [],
      impuestos: [],
      'formas-pago': [],
      certificado: [],
    },
    general: [],
    warnings: [],
    firstDestination: null,
  }
}

beforeEach(() => {
  fiscalSection.mounts = 0
  mocks.status.data = { is_initialized: true }
  mocks.status.isLoading = false
  mocks.status.isError = false
  Object.assign(mocks.entities, {
    data: entities,
    isLoading: false,
    isError: false,
  })
  Object.assign(mocks.warehouse, {
    data: warehouse,
    isLoading: false,
    isError: false,
  })
  Object.assign(mocks.taxes, { data: taxes, isLoading: false, isError: false })
  Object.assign(mocks.series, {
    data: series,
    isLoading: false,
    isError: false,
  })
  for (const mutation of [
    mocks.initialize,
    mocks.entityUpdate,
    mocks.warehouseUpdate,
    mocks.taxCreate,
    mocks.periodCreate,
    mocks.scheduleSuccessor,
    mocks.seriesUpdate,
    mocks.seriesReplace,
    mocks.logoUpload,
    mocks.logoRemove,
  ]) {
    mutation.mutate.mockReset()
    mutation.mutateAsync.mockReset()
    mutation.mutateAsync.mockResolvedValue({ id: 99 })
  }
  mocks.periods = {
    1: [
      {
        id: 11,
        rate: '15',
        starts_on: '2026-09-15',
        ends_on: null,
        version: 3,
      },
    ],
    2: [],
  }
  mocks.readiness = {
    isLoading: false,
    isError: false,
    pending: 0,
    firstDestination: null,
    byEntity: { 1: readySummary(1), 2: readySummary(2) },
  }
})

it('organiza la configuración en una navegación de cinco secciones que empieza en entidades', () => {
  renderPage()

  const links = within(sections()).getAllByRole('link')
  expect(links.map((link) => link.querySelector('span')?.textContent)).toEqual([
    'Entidades fiscales',
    'Bodega',
    'Impuestos',
    'Series y numeración',
    'Facturación electrónica',
  ])
  expect(screen.queryByRole('tablist')).toBeNull()
  expect(sectionLink('Entidades fiscales')).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(sectionLink('Series y numeración')).toHaveTextContent('3')
  expect(
    screen.getByRole('heading', { level: 2, name: 'Entidades fiscales' }),
  ).toBeVisible()
  expect(screen.queryByText('Sistema operativo')).toBeNull()
  expect(screen.getByText('Sin pendientes de configuración')).toBeVisible()
})

it('cambia de sección por enlace y conserva la dirección', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(sectionLink('Series y numeración'))

  expect(screen.getByTestId('location')).toHaveTextContent('?tab=series')
  expect(sectionLink('Series y numeración')).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(
    screen.getByRole('heading', { level: 2, name: 'Series y numeración' }),
  ).toBeVisible()
  expect(
    screen.getByRole('heading', {
      level: 2,
      name: 'Entidades fiscales',
      hidden: true,
    }),
  ).not.toBeVisible()
})

it('recorre las secciones con Tab y las activa con Intro', async () => {
  const user = userEvent.setup()
  renderPage()

  sectionLink('Bodega').focus()
  await user.tab()
  expect(sectionLink('Impuestos')).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(sectionLink('Impuestos')).toHaveAttribute('aria-current', 'page')
})

it('abre subsecciones por enlace directo y usa entidades ante una sección desconocida', () => {
  const { unmount } = renderPage('?tab=facturacion&seccion=puntos')
  expect(sectionLink('Facturación electrónica')).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(
    within(sections()).getByRole('link', { name: /Puntos de emisión/ }),
  ).toHaveAttribute('aria-current', 'page')
  unmount()

  renderPage('?tab=otra')
  expect(sectionLink('Entidades fiscales')).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('monta facturación en la primera visita y la conserva al volver', async () => {
  const user = userEvent.setup()
  renderPage()
  expect(fiscalSection.mounts).toBe(0)

  await user.click(sectionLink('Facturación electrónica'))
  expect(screen.getByText('Contenido de facturación electrónica')).toBeVisible()
  await user.click(sectionLink('Bodega'))
  await user.click(sectionLink('Facturación electrónica'))

  expect(fiscalSection.mounts).toBe(1)
})

it('resume los pendientes y enlaza a la entidad y subsección de la primera causa', () => {
  mocks.readiness = {
    ...mocks.readiness,
    pending: 2,
    firstDestination: { entityId: 1, section: 'puntos' },
  }
  renderPage()

  expect(screen.getByText('Configuración con pendientes')).toBeVisible()
  expect(
    screen.getByRole('link', {
      name: '2 pendientes en Facturación electrónica',
    }),
  ).toHaveAttribute(
    'href',
    '/configuration?tab=facturacion&entidad=1&seccion=puntos',
  )
  expect(sectionLink('Facturación electrónica')).toHaveTextContent(
    '2 pendientes',
  )
})

it('no presenta la configuración al día si el estado no pudo evaluarse', () => {
  mocks.readiness = { ...mocks.readiness, isError: true, byEntity: {} }
  renderPage()

  expect(
    screen.getByText('No se pudo evaluar el estado de la configuración'),
  ).toBeVisible()
  expect(screen.queryByText('Sin pendientes de configuración')).toBeNull()
})

it('muestra las entidades en consulta con ámbito, placa de RUC, uso y series', () => {
  renderPage()

  const commercial = screen.getByRole('article', { name: 'Entidad comercial' })
  expect(within(commercial).getByText('Comercial')).toBeVisible()
  expect(within(commercial).getByText('RUC').parentElement).toHaveTextContent(
    'RUC 1150696977001',
  )
  expect(commercial).toHaveTextContent('Sin nombre comercial')
  expect(commercial).toHaveTextContent(
    'Proveedores, ingresos, inventario y ventas de repuestos',
  )
  expect(commercial).toHaveTextContent('Lista para preparación local')
  expect(commercial).toHaveTextContent('2 activas')
  expect(within(commercial).queryByRole('textbox')).toBeNull()

  const artisan = screen.getByRole('article', { name: 'Entidad artesanal' })
  expect(artisan).toHaveTextContent(
    'Mantenimientos, reparaciones, servicios y mano de obra',
  )
  expect(artisan).toHaveTextContent('1 activa')
})

it('muestra la causa pendiente de una entidad con su enlace de resolución', () => {
  mocks.readiness.byEntity[1] = {
    ...readySummary(1),
    state: 'INCOMPLETE',
    pending: 1,
    causes: [
      {
        code: 'default_point_required',
        kind: 'MISSING',
        message: 'Designe el punto predeterminado.',
      },
    ],
    firstDestination: { entityId: 1, section: 'puntos' },
  }
  renderPage()

  const artisan = screen.getByRole('article', { name: 'Entidad artesanal' })
  expect(artisan).toHaveTextContent('Falta completar')
  expect(artisan).toHaveTextContent('Designe el punto predeterminado.')
  expect(
    within(artisan).getByRole('link', { name: 'Resolver' }),
  ).toHaveAttribute(
    'href',
    '/configuration?tab=facturacion&entidad=1&seccion=puntos',
  )
})

it('edita una entidad en un modal con su versión y notifica el guardado', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(
    screen.getByRole('button', { name: 'Editar entidad comercial' }),
  )
  const dialog = screen.getByRole('dialog', {
    name: 'Editar entidad comercial',
  })
  const name = within(dialog).getByLabelText(/Razón social/)
  await user.clear(name)
  await user.type(name, 'Repuestos VVH S.A.')
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar cambios' }),
  )

  expect(mocks.entityUpdate.mutateAsync).toHaveBeenCalledWith({
    id: 2,
    data: {
      ruc: '1150696977001',
      legal_name: 'Repuestos VVH S.A.',
      address: '',
      expected_version: 2,
    },
  })
  expect(
    await screen.findByText('Entidad comercial actualizada.'),
  ).toBeVisible()
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Editar entidad comercial' }),
    ).toBeNull(),
  )
})

it('mantiene el modal con el error junto al RUC cuando el servidor lo rechaza', async () => {
  const user = userEvent.setup()
  mocks.entityUpdate.mutateAsync.mockRejectedValue(
    new ProblemError('Datos inválidos', 400, 'validation', undefined, {
      ruc: ['El RUC ya pertenece a la otra entidad fiscal.'],
    }),
  )
  renderPage()

  await user.click(
    screen.getByRole('button', { name: 'Editar entidad comercial' }),
  )
  const dialog = screen.getByRole('dialog', {
    name: 'Editar entidad comercial',
  })
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar cambios' }),
  )

  expect(
    await within(dialog).findByText(
      'El RUC ya pertenece a la otra entidad fiscal.',
    ),
  ).toBeVisible()
  expect(within(dialog).getByLabelText(/^RUC/)).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(screen.queryByText('Entidad comercial actualizada.')).toBeNull()
})

it('consulta la bodega y cambia su nombre en un modal', async () => {
  const user = userEvent.setup()
  renderPage('?tab=bodega')

  const region = screen.getByRole('region', { name: 'Bodega' })
  expect(within(region).getByText('Bodega principal')).toBeVisible()
  expect(within(region).getByText('Activa')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Editar nombre' }))
  const dialog = screen.getByRole('dialog', { name: 'Editar bodega' })
  const input = within(dialog).getByLabelText(/Nombre de la bodega/)
  await user.clear(input)
  await user.type(input, 'Bodega central')
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar cambios' }),
  )

  expect(mocks.warehouseUpdate.mutateAsync).toHaveBeenCalledWith({
    name: 'Bodega central',
    expected_version: 1,
  })
  expect(await screen.findByText('Bodega actualizada.')).toBeVisible()
})

it('agrupa los impuestos por entidad y crea uno con su tarifa inicial', async () => {
  const user = userEvent.setup()
  renderPage('?tab=impuestos')

  const table = screen.getByRole('table')
  const groups = within(table).getAllByRole('rowheader')
  expect(groups[0]).toHaveTextContent('ComercialRepuestos VVH')
  expect(groups[1]).toHaveTextContent('ArtesanalTrasmisiones')
  expect(table).toHaveTextContent('IVA15 %')
  expect(table).toHaveTextContent('Sin tarifa vigente')

  await user.click(screen.getByRole('button', { name: 'Nuevo impuesto' }))
  const dialog = screen.getByRole('dialog', { name: 'Nuevo impuesto' })
  await user.type(within(dialog).getByLabelText(/Código/), 'ice')
  await user.type(within(dialog).getByLabelText(/Tarifa/), '10')
  await user.type(
    within(dialog).getByLabelText(/^Nombre/),
    'Consumos especiales',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Crear impuesto' }),
  )

  expect(mocks.taxCreate.mutateAsync).toHaveBeenCalledWith({
    entity_id: 2,
    code: 'ICE',
    name: 'Consumos especiales',
  })
  expect(mocks.periodCreate.mutateAsync).toHaveBeenCalledWith({
    taxDefId: 99,
    data: expect.objectContaining({ rate: '10' }),
  })
  expect(await screen.findByText('Impuesto ICE creado.')).toBeVisible()
})

it('mantiene el error de vigencia solapada dentro del modal de impuestos', async () => {
  const user = userEvent.setup()
  mocks.periodCreate.mutateAsync.mockRejectedValue(
    new Error('La vigencia se solapa con otra del mismo impuesto.'),
  )
  renderPage('?tab=impuestos')

  await user.click(screen.getByRole('button', { name: 'Nuevo impuesto' }))
  const dialog = screen.getByRole('dialog', { name: 'Nuevo impuesto' })
  await user.type(within(dialog).getByLabelText(/Código/), 'IVA')
  await user.type(within(dialog).getByLabelText(/Tarifa/), '15')
  await user.type(within(dialog).getByLabelText(/^Nombre/), 'IVA')
  await user.click(
    within(dialog).getByRole('button', { name: 'Crear impuesto' }),
  )

  expect(
    await within(dialog).findByText(
      'La vigencia se solapa con otra del mismo impuesto.',
    ),
  ).toBeVisible()
  // El modal abierto deja inaccesible la navegación hasta cerrarlo.
  expect(
    screen.queryByRole('navigation', { name: 'Secciones de configuración' }),
  ).toBeNull()
})

it('agrupa las series por entidad y ofrece corregir o sustituir según su uso', async () => {
  const user = userEvent.setup()
  renderPage('?tab=series')

  const table = screen.getByRole('table')
  const rows = within(table).getAllByRole('row')
  expect(rows.map((row) => row.textContent)).toEqual(
    expect.arrayContaining([
      expect.stringContaining('Venta de repuestosCOM-VENCOM-VEN-000004Activa'),
      expect.stringContaining('ProformaCOM-PROSin usoActiva'),
      expect.stringContaining('Operación de serviciosART-SERSin usoActiva'),
    ]),
  )
  expect(
    within(table).getByRole('button', { name: 'Sustituir serie COM-VEN' }),
  ).toBeInTheDocument()

  await user.click(
    within(table).getByRole('button', { name: 'Editar código COM-PRO' }),
  )
  const dialog = screen.getByRole('dialog', {
    name: 'Editar código de COM-PRO',
  })
  const input = within(dialog).getByLabelText(/Código de la serie/)
  await user.clear(input)
  await user.type(input, 'com-prf')
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar código' }),
  )

  expect(mocks.seriesUpdate.mutateAsync).toHaveBeenCalledWith({
    seriesId: 2,
    data: { code: 'COM-PRF', expected_version: 1 },
  })
})

it('sustituye una serie usada por una sucesora', async () => {
  const user = userEvent.setup()
  renderPage('?tab=series')

  await user.click(
    screen.getByRole('button', { name: 'Sustituir serie COM-VEN' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Sustituir COM-VEN' })
  await user.type(
    within(dialog).getByLabelText(/Código de la serie sucesora/),
    'COM-VEN2',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Sustituir serie' }),
  )

  expect(mocks.seriesReplace.mutateAsync).toHaveBeenCalledWith({
    seriesId: 1,
    data: { new_code: 'COM-VEN2', expected_version: 1 },
  })
})

it('muestra estados de carga, vacío y error por sección', () => {
  mocks.taxes.data = []
  mocks.series.data = []
  const { unmount } = renderPage('?tab=impuestos')
  expect(screen.getByText('Aún no hay impuestos configurados')).toBeVisible()
  unmount()

  mocks.warehouse.isError = true
  const second = renderPage('?tab=bodega')
  expect(screen.getByText('No se pudo cargar la bodega.')).toBeVisible()
  second.unmount()

  mocks.status.isError = true
  renderPage()
  expect(screen.getByText('No se pudo cargar la configuración.')).toBeVisible()
})

it('muestra la fila Logo con vista previa acotada o «Sin logo» y sus acciones', () => {
  renderPage()
  const commercial = screen.getByRole('article', { name: 'Entidad comercial' })
  const logo = within(commercial).getByRole('img', {
    name: 'Logo de Repuestos VVH',
  })
  expect(logo).toHaveAttribute(
    'src',
    '/api/v1/workshop-configuration/entity-logos/COMERCIAL/1/',
  )
  expect(logo).toHaveClass('object-contain')
  expect(logo.className).toMatch(/max-h-/)
  expect(logo.className).toMatch(/max-w-/)
  expect(
    within(commercial).getByRole('button', {
      name: 'Cambiar logo de la entidad comercial',
    }),
  ).toBeVisible()
  expect(
    within(commercial).getByRole('button', {
      name: 'Quitar logo de la entidad comercial',
    }),
  ).toBeVisible()

  const artisan = screen.getByRole('article', { name: 'Entidad artesanal' })
  expect(within(artisan).getByText('Sin logo')).toBeVisible()
  expect(
    within(artisan).getByRole('button', {
      name: 'Subir logo de la entidad artesanal',
    }),
  ).toBeVisible()
  expect(
    within(artisan).queryByRole('button', { name: /Quitar logo/ }),
  ).toBeNull()
})

it('abre el modal para subir el logo desde la ficha', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(
    screen.getByRole('button', { name: 'Subir logo de la entidad artesanal' }),
  )
  expect(
    screen.getByRole('dialog', { name: 'Logo de la entidad artesanal' }),
  ).toBeVisible()
})

it('quita el logo tras confirmar y notifica con un toast', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(
    screen.getByRole('button', { name: 'Quitar logo de la entidad comercial' }),
  )
  const dialog = screen.getByRole('dialog', { name: '¿Quitar el logo?' })
  expect(dialog).toHaveTextContent('mostrarán solo el nombre')
  await user.click(within(dialog).getByRole('button', { name: 'Quitar logo' }))

  expect(mocks.logoRemove.mutateAsync).toHaveBeenCalledWith({
    id: 2,
    key: expect.stringMatching(/^[A-Za-z0-9._:-]{8,128}$/),
  })
  expect(
    await screen.findByText('Logo de la entidad comercial quitado.'),
  ).toBeVisible()
})

it('cancelar el retiro conserva el logo y devuelve el foco a «Quitar»', async () => {
  const user = userEvent.setup()
  renderPage()
  const remove = screen.getByRole('button', {
    name: 'Quitar logo de la entidad comercial',
  })
  await user.click(remove)
  await user.click(
    within(screen.getByRole('dialog', { name: '¿Quitar el logo?' })).getByRole(
      'button',
      { name: 'Cancelar' },
    ),
  )
  expect(mocks.logoRemove.mutateAsync).not.toHaveBeenCalled()
  await waitFor(() => expect(remove).toHaveFocus())
})

it('programa una tarifa nueva sobre el mismo impuesto sin editar la vigente', async () => {
  const user = userEvent.setup()
  renderPage('?tab=impuestos')

  const table = screen.getByRole('table')
  // Solo el impuesto con una tarifa abierta ofrece programar otra.
  expect(
    within(table).getAllByRole('button', { name: /Programar tarifa/ }),
  ).toHaveLength(1)
  await user.click(
    within(table).getByRole('button', { name: 'Programar tarifa de IVA' }),
  )

  const dialog = screen.getByRole('dialog', { name: 'Programar tarifa de IVA' })
  expect(dialog).toHaveTextContent('15 %')
  expect(dialog).toHaveTextContent('2026-09-15')
  await user.type(within(dialog).getByLabelText(/Nueva tarifa/), '0')
  await user.type(within(dialog).getByLabelText(/Rige desde/), '2099-01-01')
  await user.click(
    within(dialog).getByRole('button', { name: 'Programar tarifa' }),
  )

  expect(mocks.scheduleSuccessor.mutateAsync).toHaveBeenCalledWith({
    periodId: 11,
    data: {
      new_rate: '0',
      successor_starts_on: '2099-01-01',
      expected_version: 3,
    },
  })
  expect(await screen.findByText('Tarifa programada.')).toBeVisible()
})

it('muestra la tarifa ya programada para el futuro en la fila del impuesto', () => {
  mocks.periods[1] = [
    {
      id: 11,
      rate: '15',
      starts_on: '2026-09-15',
      ends_on: '2098-12-31',
      version: 4,
    },
    { id: 12, rate: '0', starts_on: '2099-01-01', ends_on: null, version: 0 },
  ]
  renderPage('?tab=impuestos')

  expect(screen.getByRole('table')).toHaveTextContent(
    'Luego 0 % desde 2099-01-01',
  )
})

it('mantiene el rechazo del servidor dentro del modal de programar tarifa', async () => {
  const user = userEvent.setup()
  mocks.scheduleSuccessor.mutateAsync.mockRejectedValue(
    new Error('El inicio de la nueva tarifa debe ser posterior a hoy.'),
  )
  renderPage('?tab=impuestos')

  await user.click(
    screen.getByRole('button', { name: 'Programar tarifa de IVA' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Programar tarifa de IVA' })
  await user.type(within(dialog).getByLabelText(/Nueva tarifa/), '0')
  await user.type(within(dialog).getByLabelText(/Rige desde/), '2000-01-01')
  await user.click(
    within(dialog).getByRole('button', { name: 'Programar tarifa' }),
  )

  expect(
    await within(dialog).findByText(
      'El inicio de la nueva tarifa debe ser posterior a hoy.',
    ),
  ).toBeVisible()
  expect(screen.getByRole('dialog')).toBeVisible()
})

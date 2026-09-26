import { render, screen, within } from '@testing-library/react'
import { useLocation } from 'react-router'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type {
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'
import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

import type {
  CatalogEntry,
  ElectronicStatus,
  Establishment,
  PaymentFormOption,
  TaxMappingItem,
} from './types'

const mocks = vi.hoisted(() => {
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null as Error | null,
  })
  return {
    statusByEntity: {} as Record<number, unknown>,
    establishmentsByEntity: {} as Record<number, unknown>,
    mappingsByEntity: {} as Record<number, unknown>,
    formsByEntity: {} as Record<number, unknown>,
    defaultsByEntity: {} as Record<number, unknown>,
    profileByEntity: {} as Record<number, unknown>,
    catalog: [] as unknown[],
    saveProfile: mutation(),
    createEstablishment: mutation(),
    createPoint: mutation(),
    createTaxMapping: mutation(),
    savePreparationDefaults: mutation(),
    setPaymentForm: mutation(),
  }
})

const query = (data: unknown) => ({ data, isLoading: false, isError: false })

vi.mock('./hooks', () => ({
  useElectronicStatus: (id: number) => query(mocks.statusByEntity[id]),
  useElectronicProfile: (id: number) => query(mocks.profileByEntity[id]),
  useEstablishments: (id: number) => query(mocks.establishmentsByEntity[id]),
  useTaxMappings: (id: number) => query(mocks.mappingsByEntity[id]),
  usePaymentForms: (id: number) => query(mocks.formsByEntity[id]),
  usePreparationDefaults: (id: number) => query(mocks.defaultsByEntity[id]),
  useCatalog: () => query(mocks.catalog),
  useFiscalMutations: () => ({
    saveProfile: mocks.saveProfile,
    createEstablishment: mocks.createEstablishment,
    createPoint: mocks.createPoint,
    createTaxMapping: mocks.createTaxMapping,
    savePreparationDefaults: mocks.savePreparationDefaults,
    setPaymentForm: mocks.setPaymentForm,
  }),
}))

import { FiscalConfigurationSection } from './FiscalConfigurationSection'
import {
  summarizeEntityStatus,
  type ConfigurationReadiness,
} from './configuration/readiness'

const entities: FiscalEntity[] = [
  {
    id: 1,
    entity_type: 'COMERCIAL',
    ruc: '1150696977001',
    legal_name: 'Repuestos VVH',
    trade_name: null,
    address: 'Matriz',
    phone: null,
    email: null,
    version: 1,
  },
  {
    id: 2,
    entity_type: 'ARTESANAL',
    ruc: '1104018559001',
    legal_name: 'Taller Jiménez',
    trade_name: null,
    address: 'Taller',
    phone: null,
    email: null,
    version: 1,
  },
] as FiscalEntity[]

const taxes = [
  {
    id: 10,
    code: 'IVA',
    name: 'IVA venta',
    fiscal_entity_id: 1,
    current_rate: '15',
  },
  {
    id: 11,
    code: 'CERO',
    name: 'Tarifa cero',
    fiscal_entity_id: 1,
    current_rate: '0',
  },
] as unknown as TaxDefinition[]

function status(
  entityId: number,
  overrides: Partial<ElectronicStatus> = {},
): ElectronicStatus {
  return {
    entity_id: entityId,
    state: 'READY',
    causes: [],
    warnings: [
      {
        code: 'certificate_missing',
        kind: 'REVIEW',
        message: 'Certificado sin declarar: no impide preparar localmente.',
      },
    ],
    environment: 'TEST',
    profile_revision: 1,
    default_point_id: 8,
    default_payment_code: '01',
    ...overrides,
  }
}

function establishment(entityId: number, codes: string[]): Establishment[] {
  return [
    {
      id: entityId * 10,
      entity_id: entityId,
      code: '001',
      address: `Dirección ${entityId}`,
      is_active: true,
      version: 1,
      points: codes.map((code, index) => ({
        id: entityId * 100 + index,
        establishment_id: entityId * 10,
        code,
        is_active: true,
        version: 1,
      })),
    },
  ]
}

const paymentCodes: Array<[string, string, boolean]> = [
  ['01', 'Efectivo o sin sistema financiero', true],
  ['15', 'Compensación de deudas', false],
  ['16', 'Tarjeta de débito', false],
  ['17', 'Dinero electrónico', false],
  ['18', 'Tarjeta prepago', false],
  ['19', 'Tarjeta de crédito', false],
  ['20', 'Transferencia u otros con sistema financiero', true],
  ['21', 'Endoso de títulos', false],
]

function paymentForms(): PaymentFormOption[] {
  return paymentCodes.map(([code, display_name, enableable]) => ({
    code,
    description: display_name.toUpperCase(),
    display_name,
    catalog_version: 'SRI-2.34-TABLA24',
    source_document: 'Ficha técnica de comprobantes electrónicos',
    source_version: '2.34',
    source_url: 'https://www.sri.gob.ec/',
    downloaded_on: '2026-09-26',
    valid_from: '2016-06-01',
    valid_to: null,
    is_current: true,
    enableable,
    enabled: enableable,
    is_default: code === '01',
    internal_method: enableable
      ? code === '01'
        ? 'EFECTIVO'
        : 'TRANSFERENCIA'
      : null,
    version: 0,
  }))
}

const catalog: CatalogEntry[] = [
  ['0', 'IVA 0 %'],
  ['4', 'IVA 15 %'],
  ['6', 'No objeto de IVA'],
  ['7', 'Exento de IVA'],
].map(([code, display_name], index) => ({
  id: index + 1,
  kind: 'TAX_RATE',
  catalog_version: 'SRI-2.34-TABLA17',
  code: code!,
  description: display_name!,
  display_name: display_name!,
  tax_code: '2',
  rate: '0',
  treatment: 'RATE',
  source_document: 'Ficha técnica',
  source_version: '2.34',
  source_reference: 'Tabla 17',
  source_url: 'https://www.sri.gob.ec/',
  downloaded_on: '2026-09-26',
  valid_from: null,
  valid_to: null,
  validity_note: 'La Tabla 17 no publica fechas de vigencia.',
  is_active: true,
  is_selectable: true,
  incorporated_at: '2026-09-26T00:00:00Z',
}))

const mapping: TaxMappingItem = {
  id: 3,
  definition_id: 10,
  definition_name: 'IVA venta',
  catalog_version: 'SRI-2.34-TABLA17',
  percentage_code: '4',
  catalog_entry_id: 2,
  display_name: 'IVA 15 %',
  rate: '15',
  treatment: 'RATE',
  starts_on: '2026-01-01',
  ends_on: null,
  source: 'Certificado RUC',
  is_current: true,
}

beforeEach(() => {
  mocks.statusByEntity = {
    1: status(1),
    2: status(2, {
      state: 'NOT_CONFIGURED',
      profile_revision: null,
      causes: [
        {
          code: 'profile',
          kind: 'MISSING',
          message: 'Todavía no existe una configuración guardada.',
        },
      ],
    }),
  }
  mocks.establishmentsByEntity = {
    1: establishment(1, ['001', '002']),
    2: establishment(2, ['003']),
  }
  mocks.mappingsByEntity = { 1: [mapping], 2: [] }
  mocks.formsByEntity = { 1: paymentForms(), 2: paymentForms() }
  mocks.defaultsByEntity = {
    1: {
      entity_id: 1,
      version: 0,
      designated_point_id: null,
      effective_point_id: null,
      point_issue: 'default_point_required',
      default_payment_code: '01',
      payment_issue: null,
    },
    2: {
      entity_id: 2,
      version: 0,
      designated_point_id: null,
      effective_point_id: 200,
      point_issue: null,
      default_payment_code: '01',
      payment_issue: null,
    },
  }
  mocks.profileByEntity = {
    1: {
      entity_id: 1,
      revision: 1,
      conditions: {
        tax_regime: {
          status: 'APPLICABLE',
          value: 'GENERAL',
          source: 'Certificado RUC',
          starts_on: '2026-01-01',
        },
      },
      certificate: null,
    },
    2: { entity_id: 2, revision: 0, conditions: {}, certificate: null },
  }
  mocks.catalog = catalog
  for (const mutation of [
    mocks.saveProfile,
    mocks.createEstablishment,
    mocks.createPoint,
    mocks.createTaxMapping,
    mocks.savePreparationDefaults,
    mocks.setPaymentForm,
  ]) {
    mutation.mutate.mockReset()
    mutation.mutateAsync.mockReset()
    mutation.mutateAsync.mockResolvedValue({})
    mutation.isError = false
    mutation.error = null
  }
})

function readinessFor(ids = [1, 2]): ConfigurationReadiness {
  const summaries = ids.map((id) =>
    summarizeEntityStatus(mocks.statusByEntity[id] as ElectronicStatus),
  )
  return {
    isLoading: false,
    isError: false,
    pending: summaries.reduce((total, item) => total + item.pending, 0),
    firstDestination:
      summaries.find((item) => item.firstDestination)?.firstDestination ?? null,
    byEntity: Object.fromEntries(
      summaries.map((item) => [item.entityId, item]),
    ),
  }
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>
}

function renderSection(search = '?tab=facturacion', definitions = taxes) {
  return render(
    <MemoryRouter initialEntries={[`/configuration${search}`]}>
      <ToastProvider>
        <FiscalConfigurationSection
          entities={entities}
          readiness={readinessFor()}
          taxDefinitions={definitions}
        />
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  )
}

function panel(name: RegExp | string) {
  return screen.getByRole('region', { name })
}

it('muestra el aviso en una línea, las entidades seleccionables y las subsecciones sin franja de estado', () => {
  renderSection()

  expect(
    screen.getByText(
      'Configuración para preparación local. La emisión electrónica todavía no está habilitada.',
    ),
  ).toBeVisible()
  const choices = within(
    screen.getByRole('group', { name: 'Entidad fiscal' }),
  ).getAllByRole('radio')
  expect(choices).toHaveLength(2)
  expect(choices[0]).toBeChecked()
  const commercial = choices[0]!.closest('label')!
  expect(commercial).toHaveTextContent('Comercial')
  expect(commercial).toHaveTextContent('Repuestos VVH')
  expect(commercial).not.toHaveTextContent('RUC')
  expect(
    screen.getByText('RUC', { selector: 'span' }).parentElement,
  ).toHaveTextContent('RUC 1150696977001')
  expect(commercial).toHaveTextContent('Lista')
  expect(choices[1]!.closest('label')).toHaveTextContent('Sin configurar')

  expect(
    screen.queryByRole('status', { name: 'Estado de la configuración' }),
  ).toBeNull()
  expect(screen.queryByText(/Certificado sin declarar/)).toBeNull()
  expect(screen.queryByText('Preparación local')).toBeNull()

  const subsections = screen.getByRole('navigation', {
    name: 'Subsecciones de facturación electrónica',
  })
  expect(
    within(subsections)
      .getAllByRole('link')
      .map((link) => link.firstChild?.textContent),
  ).toEqual([
    'Perfil tributario',
    'Puntos de emisión',
    'Impuestos SRI',
    'Formas de pago',
    'Certificado',
  ])
  expect(
    within(subsections).getByRole('link', { name: /Perfil tributario/ }),
  ).toHaveAttribute('aria-current', 'page')
})

it('cambia de entidad por la dirección y reemplaza todos los datos de la anterior', async () => {
  const user = userEvent.setup()
  renderSection('?tab=facturacion&seccion=puntos')

  expect(screen.getByText('001-002')).toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: /Taller Jiménez/ }))

  expect(screen.getByTestId('location')).toHaveTextContent('entidad=2')
  expect(screen.getByRole('radio', { name: /Taller Jiménez/ })).toBeChecked()
  expect(screen.queryByText('001-002')).not.toBeInTheDocument()
  expect(screen.getAllByText('001-003').length).toBeGreaterThan(0)
})

it('muestra una causa sin subsección conocida en una línea bajo el selector', () => {
  mocks.statusByEntity[2] = status(2, {
    state: 'INCOMPLETE',
    causes: [{ code: 'causa_nueva', kind: 'MISSING', message: 'Causa nueva.' }],
  })
  renderSection('?tab=facturacion&entidad=2')

  expect(
    within(
      screen.getByRole('list', { name: 'Pendientes generales' }),
    ).getByText('Causa nueva.'),
  ).toBeVisible()
  expect(screen.getByRole('radio', { name: /Taller Jiménez/ })).toBeChecked()
})

it('muestra el perfil sin guardar como pendiente de Perfil tributario', () => {
  renderSection('?tab=facturacion&entidad=2')

  expect(
    within(panel('Perfil tributario')).getByRole('list', {
      name: 'Pendientes',
    }),
  ).toHaveTextContent('Todavía no existe una configuración guardada.')
  expect(
    screen.queryByRole('list', { name: 'Pendientes generales' }),
  ).toBeNull()
})

it('muestra cada causa al inicio de la subsección que la resuelve', () => {
  mocks.statusByEntity[1] = status(1, {
    state: 'INCOMPLETE',
    causes: [
      {
        code: 'default_point_required',
        kind: 'MISSING',
        message: 'Designe el punto de emisión predeterminado.',
      },
    ],
  })
  renderSection('?tab=facturacion&seccion=puntos')

  expect(
    within(panel('Establecimientos y puntos de emisión')).getByRole('list', {
      name: 'Pendientes',
    }),
  ).toHaveTextContent('Designe el punto de emisión predeterminado.')
  expect(
    screen.queryByRole('list', { name: 'Pendientes generales' }),
  ).toBeNull()
  expect(
    within(
      screen.getByRole('navigation', {
        name: 'Subsecciones de facturación electrónica',
      }),
    ).getByRole('link', { name: /Puntos de emisión/ }),
  ).toHaveTextContent('1 pendiente')
})

it('presenta el perfil como tabla de consulta y declara una condición en su modal', async () => {
  const user = userEvent.setup()
  renderSection()

  const table = within(panel('Perfil tributario')).getByRole('table')
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(6)
  expect(rows[0]).toHaveTextContent('Régimen tributarioAplicaGENERAL2026-01-01')
  expect(rows[3]).toHaveTextContent('Agente de retenciónSin declarar')
  expect(within(table).queryByRole('textbox')).not.toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: 'Declarar Agente de retención' }),
  )
  const dialog = screen.getByRole('dialog', {
    name: 'Declarar: Agente de retención',
  })
  expect(within(dialog).queryByLabelText(/Fuente o documento/)).toBeNull()
  await user.click(within(dialog).getByRole('radio', { name: 'No aplica' }))
  await user.type(
    within(dialog).getByLabelText(/Fuente o documento/),
    'Certificado RUC',
  )
  await user.type(within(dialog).getByLabelText(/Vigente desde/), '2026-02-01')
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )

  expect(mocks.saveProfile.mutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      entityId: 1,
      data: {
        expected_revision: 1,
        certificate: null,
        conditions: expect.objectContaining({
          tax_regime: expect.objectContaining({ value: 'GENERAL' }),
          withholding_agent: {
            status: 'NOT_APPLICABLE',
            source: 'Certificado RUC',
            starts_on: '2026-02-01',
          },
          rimpe: { status: 'UNKNOWN' },
        }),
      },
    }),
  )
  expect(await screen.findByText('Condición guardada.')).toBeInTheDocument()
})

it('explica el conflicto de revisión dentro del modal y conserva lo escrito', async () => {
  const user = userEvent.setup()
  mocks.saveProfile.mutateAsync.mockRejectedValue(
    new ProblemError('Conflicto', 409, 'revision_conflict'),
  )
  renderSection()

  await user.click(
    screen.getByRole('button', { name: 'Editar Régimen tributario' }),
  )
  const dialog = screen.getByRole('dialog', {
    name: 'Editar: Régimen tributario',
  })
  const value = within(dialog).getByLabelText(/Régimen declarado/)
  await user.clear(value)
  await user.type(value, 'RIMPE')
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )

  expect(
    await within(dialog).findByText(/Otro guardado cambió el perfil/),
  ).toBeInTheDocument()
  expect(within(dialog).getByLabelText(/Régimen declarado/)).toHaveValue(
    'RIMPE',
  )
})

it('designa el punto predeterminado en un modal cuando hay varios activos', async () => {
  const user = userEvent.setup()
  renderSection('?tab=facturacion&seccion=puntos')

  const section = panel('Establecimientos y puntos de emisión')
  expect(section).toHaveTextContent('Sin designar')
  await user.click(
    within(section).getByRole('button', { name: 'Designar punto' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Punto predeterminado' })
  await user.selectOptions(
    within(dialog).getByLabelText(/Punto de emisión/),
    '101',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar punto' }),
  )

  expect(mocks.savePreparationDefaults.mutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      entityId: 1,
      data: { expected_version: 0, default_point_id: 101 },
    }),
  )
})

it('muestra correspondencias por nombre y deja el código oficial en información avanzada', async () => {
  const user = userEvent.setup()
  renderSection('?tab=facturacion&seccion=impuestos')

  const section = panel('Impuestos y catálogo SRI')
  expect(within(section).getByRole('table')).toHaveTextContent('IVA 15 %')
  const advanced = within(section).getByText('Información avanzada')
  expect(advanced.closest('details')).not.toHaveAttribute('open')
  expect(advanced.closest('details')).toHaveTextContent('código SRI 4')

  await user.click(
    within(section).getByRole('button', { name: 'Nueva correspondencia' }),
  )
  const dialog = screen.getByRole('dialog', {
    name: 'Nueva correspondencia tributaria',
  })
  expect(within(dialog).getByLabelText(/Impuesto interno/)).toBeInTheDocument()
  expect(
    within(dialog).getByText(
      'Fuente o referencia que justifica esta correspondencia tributaria.',
    ),
  ).toBeInTheDocument()
})

it('presenta un único impuesto interno como dato fijo y avisa sin definiciones', async () => {
  const user = userEvent.setup()
  const { unmount } = renderSection('?tab=facturacion&seccion=impuestos', [
    taxes[0]!,
  ])
  await user.click(
    screen.getByRole('button', { name: 'Nueva correspondencia' }),
  )
  const dialog = screen.getByRole('dialog', {
    name: 'Nueva correspondencia tributaria',
  })
  expect(within(dialog).getByText('IVA venta · 15 %')).toBeInTheDocument()
  expect(within(dialog).queryByLabelText(/Impuesto interno/)).toBeNull()
  unmount()

  renderSection('?tab=facturacion&seccion=impuestos', [])
  expect(
    screen.getByText(
      'Primero debe configurarse el catálogo tributario de esta entidad.',
    ),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Nueva correspondencia' }),
  ).toBeNull()
})

it('lista las ocho formas de pago y solo permite actuar sobre 01 y 20', () => {
  renderSection('?tab=facturacion&seccion=formas-pago')

  const table = within(panel('Formas de pago SRI')).getByRole('table')
  expect(within(table).getAllByRole('row').slice(1)).toHaveLength(8)
  expect(
    within(table).getByRole('button', {
      name: 'Deshabilitar Efectivo o sin sistema financiero',
    }),
  ).toBeInTheDocument()
  expect(within(table).queryByRole('button', { name: /Tarjeta/ })).toBeNull()
  expect(within(table).getAllByText('No habilitable en V1')).toHaveLength(6)
})

it('mantiene el certificado opcional y rechaza datos parciales en su modal', async () => {
  const user = userEvent.setup()
  renderSection('?tab=facturacion&seccion=certificado')

  const section = panel('Certificado electrónico')
  expect(section).toHaveTextContent('Sin certificado declarado.')
  await user.click(
    within(section).getByRole('button', { name: 'Declarar certificado' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Certificado electrónico' })
  await user.type(within(dialog).getByLabelText('Titular'), 'Taller')
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar certificado' }),
  )

  expect(
    within(dialog).getByText(
      'Complete todos los datos del certificado o déjelos todos vacíos.',
    ),
  ).toBeInTheDocument()
  expect(mocks.saveProfile.mutateAsync).not.toHaveBeenCalled()
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type {
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'
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
    mutation.isError = false
    mutation.error = null
  }
})

function renderSection(search = '?tab=facturacion', definitions = taxes) {
  return render(
    <MemoryRouter initialEntries={[`/configuration${search}`]}>
      <ToastProvider>
        <FiscalConfigurationSection
          entities={entities}
          taxDefinitions={definitions}
        />
      </ToastProvider>
    </MemoryRouter>,
  )
}

it('shows the permanent local-preparation notice, the status with causes and five subsections', () => {
  renderSection()
  expect(
    screen.getByText(
      /Configuración para preparación local\. La emisión electrónica todavía no está habilitada\./,
    ),
  ).toBeVisible()
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'Perfil tributario',
    'Establecimientos y puntos de emisión',
    'Impuestos y catálogo SRI',
    'Formas de pago SRI',
    'Certificado electrónico',
  ])
  expect(
    screen.getByRole('status', {
      name: 'Estado: Lista para preparación local',
    }),
  ).toBeVisible()
  expect(screen.getByText('Pruebas')).toBeVisible()
  expect(screen.getByText(/no está validada por el SRI/)).toBeVisible()
  expect(
    screen.getByText(
      'Certificado sin declarar: no impide preparar localmente.',
    ),
  ).toBeVisible()
})

it('replaces every subsection when switching from the commercial to the artisan entity', async () => {
  const user = userEvent.setup()
  renderSection()
  await user.click(
    screen.getByRole('tab', { name: 'Establecimientos y puntos de emisión' }),
  )
  expect(screen.getByText('Dirección 1')).toBeVisible()
  expect(screen.getByText('Falta el punto predeterminado')).toBeVisible()

  await user.selectOptions(screen.getByLabelText('Entidad fiscal'), '2')

  expect(
    screen.getByText(/Taller Jiménez/, { selector: 'strong' }),
  ).toBeVisible()
  expect(screen.queryByText('Dirección 1')).toBeNull()
  expect(screen.getByText('Dirección 2')).toBeVisible()
  expect(screen.queryByText('Falta el punto predeterminado')).toBeNull()
  expect(
    screen.getByRole('status', { name: 'Estado: Sin configurar' }),
  ).toBeVisible()
  expect(
    screen.getByText('Todavía no existe una configuración guardada.'),
  ).toBeVisible()
})

it('discards unsaved forms and errors of the previous entity', async () => {
  const user = userEvent.setup()
  mocks.createPoint.isError = true
  mocks.createPoint.error = new Error('Punto duplicado en la entidad comercial')
  renderSection('?tab=facturacion&seccion=impuestos')
  await user.type(screen.getByLabelText('Fundamento'), 'Texto sin guardar')
  expect(
    screen.getByText('Punto duplicado en la entidad comercial'),
  ).toBeInTheDocument()

  mocks.createPoint.isError = false
  mocks.createPoint.error = null
  await user.selectOptions(screen.getByLabelText('Entidad fiscal'), '2')

  expect(
    screen.queryByText('Punto duplicado en la entidad comercial'),
  ).toBeNull()
  expect(
    screen.getByText(
      'Primero debe configurarse el catálogo tributario de esta entidad.',
    ),
  ).toBeVisible()
  await user.selectOptions(screen.getByLabelText('Entidad fiscal'), '1')
  expect(screen.getByLabelText('Fundamento')).toHaveValue('')
})

it('declares tax conditions with contextual help and explains «Sin configuración guardada»', async () => {
  const user = userEvent.setup()
  renderSection()
  await user.selectOptions(screen.getByLabelText('Entidad fiscal'), '2')
  expect(screen.getByText(/Sin configuración guardada/)).toBeVisible()
  expect(screen.queryByText(/Revisión 0/)).toBeNull()

  const rimpe = screen.getByRole('group', { name: 'RIMPE' })
  expect(within(rimpe).getByText(/Emprendedor o Negocio popular/)).toBeVisible()
  await user.selectOptions(
    within(rimpe).getByLabelText('Situación'),
    'APPLICABLE',
  )
  await user.type(
    within(rimpe).getByLabelText('Categoría RIMPE'),
    'Emprendedor',
  )
  await user.type(
    within(rimpe).getByLabelText('Fuente o documento'),
    'Certificado RUC',
  )
  await user.type(within(rimpe).getByLabelText('Vigente desde'), '2026-01-01')
  await user.click(
    screen.getByRole('button', { name: 'Guardar perfil tributario' }),
  )

  const call = mocks.saveProfile.mutate.mock.calls[0]![0]
  expect(call.entityId).toBe(2)
  expect(call.data.expected_revision).toBe(0)
  expect(call.data.conditions.rimpe).toEqual({
    status: 'APPLICABLE',
    value: 'Emprendedor',
    source: 'Certificado RUC',
    starts_on: '2026-01-01',
  })
  expect(call.data.conditions.tax_regime).toEqual({ status: 'UNKNOWN' })
})

it('designates the default point among several active points', async () => {
  const user = userEvent.setup()
  renderSection('?tab=facturacion&seccion=puntos')
  await user.selectOptions(
    screen.getByLabelText('Punto predeterminado para preparar'),
    '101',
  )
  await user.click(screen.getByRole('button', { name: 'Designar punto' }))
  expect(mocks.savePreparationDefaults.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      entityId: 1,
      data: { expected_version: 0, default_point_id: 101 },
    }),
    expect.anything(),
  )
})

it('selects official rates by name, explains the basis and lists mappings with advanced code', async () => {
  const user = userEvent.setup()
  renderSection('?tab=facturacion&seccion=impuestos')
  const rate = screen.getByLabelText('Tarifa del catálogo SRI')
  expect(
    within(rate)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['IVA 0 %', 'IVA 15 %', 'No objeto de IVA', 'Exento de IVA'])
  expect(screen.queryByLabelText('Código tarifa')).toBeNull()
  expect(
    screen.getByText(
      'Fuente o referencia que justifica esta correspondencia tributaria.',
    ),
  ).toBeVisible()
  expect(screen.getByText('IVA venta → IVA 15 %')).toBeVisible()
  expect(screen.getByText(/Código SRI 4/)).not.toBeVisible()

  const panel = within(screen.getByRole('tabpanel'))
  await user.selectOptions(panel.getByLabelText('Impuesto interno'), '10')
  await user.selectOptions(rate, '2')
  await user.type(panel.getByLabelText('Vigente desde'), '2026-01-01')
  await user.type(panel.getByLabelText('Fundamento'), 'Certificado RUC')
  await user.click(
    screen.getByRole('button', { name: 'Guardar correspondencia' }),
  )
  expect(mocks.createTaxMapping.mutate).toHaveBeenCalledWith(
    {
      definition_id: 10,
      catalog_entry_id: 2,
      starts_on: '2026-01-01',
      ends_on: null,
      source: 'Certificado RUC',
    },
    expect.anything(),
  )
})

it('shows a single internal tax as fixed data instead of a selector', () => {
  renderSection('?tab=facturacion&seccion=impuestos', [taxes[0]!])
  expect(screen.queryByLabelText('Impuesto interno')).toBeNull()
  expect(
    screen.getByText('Es el único impuesto interno de esta entidad.'),
  ).toBeVisible()
})

it('lists the eight official payment forms and only lets 01 and 20 be toggled', async () => {
  const user = userEvent.setup()
  renderSection('?tab=facturacion&seccion=formas-pago')
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(9)
  expect(within(table).getByText('Tarjeta de crédito')).toBeVisible()
  expect(within(table).getAllByText('No habilitable en V1')).toHaveLength(6)
  expect(
    screen.getByText(/versión 2\.34, descargada el 2026-09-26/),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /Tarjeta de crédito/ }),
  ).toBeNull()

  await user.click(
    screen.getByRole('button', {
      name: 'Deshabilitar Transferencia u otros con sistema financiero',
    }),
  )
  expect(mocks.setPaymentForm.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ entityId: 1, code: '20', enabled: false }),
    expect.anything(),
  )
  await user.click(
    screen.getByRole('button', { name: 'Usar como predeterminada' }),
  )
  expect(mocks.savePreparationDefaults.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { expected_version: 0, default_payment_code: '20' },
    }),
    expect.anything(),
  )
})

it('keeps the certificate optional, explains it and rejects partial data locally', async () => {
  const user = userEvent.setup()
  renderSection('?tab=facturacion&seccion=certificado')
  expect(
    screen.getByText(/no equivalen a una firma ni a una autorización/),
  ).toBeVisible()
  expect(screen.getByLabelText('Referencia o identificador')).toBeVisible()
  expect(screen.getByLabelText('Entidad emisora del certificado')).toBeVisible()
  expect(screen.queryByLabelText(/contraseña/i)).toBeNull()
  expect(document.querySelector('input[type="file"]')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Guardar certificado' }))
  expect(mocks.saveProfile.mutate.mock.calls[0]![0].data.certificate).toBeNull()

  await user.type(screen.getByLabelText('Titular'), 'Solo titular')
  await user.click(screen.getByRole('button', { name: 'Guardar certificado' }))
  expect(
    screen.getByText(
      'Complete todos los datos del certificado o déjelos todos vacíos.',
    ),
  ).toBeVisible()
  expect(mocks.saveProfile.mutate).toHaveBeenCalledTimes(1)
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { expectNoForbiddenFiscalTerms } from '@/features/fiscal/terminology.test-utils'
import type { FiscalPreparationDetail } from '@/features/fiscal/types'
import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

import { FiscalPreparationPage } from './FiscalPreparationPage'

const mocks = vi.hoisted(() => {
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null as Error | null,
    data: null as unknown,
  })
  return {
    preparation: {
      isPending: false,
      isError: false,
      data: null as unknown,
      refetch: vi.fn(),
    },
    updateDraft: mutation(),
    review: mutation(),
    prepare: mutation(),
  }
})

vi.mock('@/features/fiscal/hooks', () => ({
  usePreparation: () => mocks.preparation,
  useFiscalMutations: () => ({
    updateDraft: mocks.updateDraft,
    review: mocks.review,
    prepare: mocks.prepare,
  }),
}))

function detail(
  overrides: Partial<FiscalPreparationDetail> = {},
): FiscalPreparationDetail {
  return {
    preparation_id: '11111111-1111-1111-1111-111111111111',
    fiscal_entity_id: 1,
    source: { kind: 'COMMERCIAL', id: 7, version: 1 },
    state: 'DRAFT',
    version: 1,
    draft: {},
    snapshot: null,
    discrepancy: {
      source_changed: false,
      state_changed: false,
      corrections_changed: false,
      original_state: 'CONFIRMED',
      current_state: 'CONFIRMED',
      original_source_version: 1,
      current_source_version: 1,
      current_correction_ids: [],
    },
    cancellation_reason: '',
    created_at: '2026-09-25T10:00:00Z',
    prepared_at: null,
    official_status: null,
    official_submission: 'NOT_PERFORMED',
    summary: {
      kind: 'COMMERCIAL',
      internal_number: 'COM-VEN-000012',
      operational_date: '2026-09-25',
      condition: 'CREDITO',
      state: 'CONFIRMED',
      base_total: '86.96',
      tax_total: '13.04',
      grand_total: '100.00',
      lines: [
        {
          position: 1,
          description: 'Filtro de aceite',
          quantity: '2',
          total: '100.00',
        },
      ],
    },
    issuer: { ruc: '1150696977001', legal_name: 'Repuestos VVH' },
    working: {
      draft_format: 3,
      receiver: {
        identification_type: '04',
        identification: '0999999999001',
        legal_name: 'Cliente Fiscal S.A.',
      },
      payments: {
        forms: [
          { payment_code: '01', amount: '40.00' },
          { payment_code: '20', amount: '60.00' },
        ],
        suggested: true,
        suggestion_origin: 'COLLECTED',
      },
      additional_info: [],
      service_details: [],
      term_required: false,
    },
    payment_options: [
      {
        code: '01',
        display_name: 'Efectivo o sin sistema financiero',
        description: 'SIN UTILIZACION DEL SISTEMA FINANCIERO',
        internal_method: 'EFECTIVO',
      },
      {
        code: '20',
        display_name: 'Transferencia u otros con sistema financiero',
        description: 'OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO',
        internal_method: 'TRANSFERENCIA',
      },
    ],
    missing_fields: ['address', 'email'],
    technical: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/fiscal/preparations/x']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/fiscal/preparations/:id"
            element={<FiscalPreparationPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.preparation.data = detail()
  for (const mutation of [mocks.updateDraft, mocks.review, mocks.prepare]) {
    mutation.mutate.mockReset()
    mutation.mutateAsync.mockReset()
    mutation.reset.mockReset()
    mutation.isError = false
    mutation.error = null
    mutation.data = null
  }
})

it('shows a simple summary and the mandatory local-preparation notice', () => {
  const { container } = renderPage()
  expect(screen.getByRole('heading', { name: 'Borrador fiscal' })).toBeVisible()
  expect(
    screen.getByText(
      'Esta preparación todavía no es una factura electrónica. No ha sido firmada ni enviada al SRI.',
    ),
  ).toBeVisible()
  const summary = screen.getByRole('region', {
    name: 'Resumen de la operación',
  })
  expect(
    within(summary).getByText('Venta comercial COM-VEN-000012'),
  ).toBeVisible()
  expect(
    within(summary).getByText('Repuestos VVH · RUC 1150696977001'),
  ).toBeVisible()
  expect(within(summary).getByText('Filtro de aceite')).toBeVisible()
  expect(within(summary).getByText('Crédito')).toBeVisible()
  expectNoForbiddenFiscalTerms(container)
})

it('asks only for missing receiver data and hides technical fields', () => {
  renderPage()
  const receiver = screen.getByRole('region', { name: 'Receptor' })
  expect(within(receiver).getByText('Cliente Fiscal S.A.')).toBeVisible()
  expect(within(receiver).getByLabelText('Dirección (opcional)')).toBeVisible()
  expect(within(receiver).getByLabelText('Correo')).toBeRequired()
  expect(within(receiver).queryByLabelText(/Correo \(opcional\)/)).toBeNull()
  expect(within(receiver).queryByLabelText('Identificación')).toBeNull()
  for (const technical of [
    /ambiente/i,
    /punto de emisión/i,
    /medio SRI/i,
    /fecha de referencia/i,
    /plazo/i,
    /unidad/i,
    /código de tarifa/i,
  ]) {
    expect(screen.queryByLabelText(technical)).toBeNull()
  }
})

it('presents the payment suggestion from collections and lets it be changed', async () => {
  const user = userEvent.setup()
  renderPage()
  const payments = screen.getByRole('region', { name: 'Formas de pago' })
  expect(
    within(payments).getByText(/Sugerido desde los cobros registrados/),
  ).toBeVisible()
  expect(
    within(payments).getByText(/no registra ni modifica cobros/),
  ).toBeVisible()
  const selects = within(payments).getAllByLabelText('Forma de pago')
  expect(selects).toHaveLength(2)
  expect(
    within(selects[0]!)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual([
    'Efectivo o sin sistema financiero',
    'Transferencia u otros con sistema financiero',
  ])
  expect(
    within(payments).getByText('Cubre el total de USD 100.00.'),
  ).toBeVisible()

  const amounts = within(payments).getAllByLabelText('Importe')
  await user.clear(amounts[1]!)
  await user.type(amounts[1]!, '59.99')
  expect(
    within(payments).getByText('Diferencia con el total: USD 0.01'),
  ).toBeVisible()
})

it('saves only receiver and payment forms, then reviews', async () => {
  const user = userEvent.setup()
  mocks.updateDraft.mutateAsync.mockResolvedValue({})
  renderPage()
  await user.type(screen.getByLabelText('Dirección (opcional)'), 'Calle 10')
  await user.type(screen.getByLabelText('Correo'), 'cliente@example.com')
  await user.click(
    screen.getByRole('button', { name: 'Revisar datos para facturación' }),
  )
  expect(mocks.updateDraft.mutateAsync).toHaveBeenCalledWith({
    preparationId: '11111111-1111-1111-1111-111111111111',
    data: {
      expected_version: 1,
      receiver: {
        identification_type: '04',
        identification: '0999999999001',
        legal_name: 'Cliente Fiscal S.A.',
        address: 'Calle 10',
        email: 'cliente@example.com',
      },
      payments: {
        forms: [
          { payment_code: '01', amount: '40.00' },
          { payment_code: '20', amount: '60.00' },
        ],
      },
      additional_info: [],
    },
  })
  expect(mocks.review.mutate).toHaveBeenCalledWith({
    preparationId: '11111111-1111-1111-1111-111111111111',
  })
})

it('groups impediments by who must resolve them', () => {
  mocks.review.data = {
    review_token: null,
    impediments: [
      {
        field: 'receiver.identification',
        code: 'receiver.identification',
        audience: 'OPERATOR',
        message: 'La cédula debe tener 10 dígitos ASCII.',
      },
      {
        field: 'config.default_point_required',
        code: 'default_point_required',
        audience: 'ADMINISTRATOR',
        message:
          'La entidad tiene varios puntos activos sin punto predeterminado. Debe resolverlo el Administrador.',
      },
    ],
  }
  renderPage()
  expect(
    within(
      screen.getByRole('list', { name: 'Puede completarlo aquí' }),
    ).getByText('La cédula debe tener 10 dígitos ASCII.'),
  ).toBeVisible()
  expect(
    within(
      screen.getByRole('list', { name: 'Debe resolverlo el Administrador' }),
    ).getByText(/varios puntos activos/),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Guardar preparación local' }),
  ).toBeNull()
})

it('completes the local preparation after a clean review', async () => {
  const user = userEvent.setup()
  mocks.review.data = { review_token: 'token-1', impediments: [] }
  renderPage()
  await user.click(
    screen.getByRole('button', { name: 'Guardar preparación local' }),
  )
  expect(mocks.prepare.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ reviewToken: 'token-1' }),
    expect.anything(),
  )
})

it('explains a stale review without inventing an official state', () => {
  mocks.review.data = { review_token: 'token-1', impediments: [] }
  mocks.prepare.isError = true
  mocks.prepare.error = new ProblemError('stale', 409, 'review_stale')
  renderPage()
  expect(
    screen.getByText(
      /La configuración o la fecha cambiaron después de revisar/,
    ),
  ).toBeVisible()
})

it('shows the prepared data as a pending-emission local preparation', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    payment_options: [],
    snapshot: {
      reference_date: '2026-09-25',
      receiver: {
        legal_name: 'Cliente Fiscal S.A.',
        identification: '0999999999001',
      },
      totals: { tax: '13.04', grand: '100.00' },
      lines: [
        {
          position: 1,
          description: 'Filtro de aceite',
          quantity: '2',
          total_amount: '100.00',
          display_name: 'IVA 15 %',
        },
      ],
      payments: [
        {
          payment_code: '20',
          amount: '100.00',
          display_name: 'Transferencia u otros con sistema financiero',
        },
      ],
    },
  })
  const { container } = renderPage()
  expect(
    screen.getByRole('heading', { name: 'Preparación local' }),
  ).toBeVisible()
  expect(
    screen.getByRole('status', {
      name: 'Estado: Preparación local · Pendiente de emisión',
    }),
  ).toBeVisible()
  expect(screen.getByText('IVA 15 %')).toBeVisible()
  expect(
    screen.getByText(/Transferencia u otros con sistema financiero/),
  ).toBeVisible()
  expect(screen.queryByText('Información avanzada')).toBeNull()
  expectNoForbiddenFiscalTerms(container)
})

it('shows advanced technical information only when the API includes it', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    snapshot: { receiver: {}, totals: {}, lines: [], payments: [] },
    technical: { configuration: { point: { code: '001' } } },
  })
  renderPage()
  expect(screen.getByText('Información avanzada')).toBeInTheDocument()
})

it('keeps the cancelled state as a local cancellation', () => {
  mocks.preparation.data = detail({
    state: 'CANCELLED',
    working: null,
    cancellation_reason: 'Dato incorrecto',
  })
  const { container } = renderPage()
  expect(screen.getByText('Dato incorrecto')).toBeVisible()
  expect(
    screen.getByRole('status', { name: 'Estado: Cancelada localmente' }),
  ).toBeVisible()
  expectNoForbiddenFiscalTerms(container)
})

it('shows a format-1 local preparation as frozen without inventing configuration references', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    payment_options: [],
    snapshot: {
      schema_version: 'factura-2.1.0',
      reference_date: '2026-09-20',
      receiver: {
        legal_name: 'Cliente antiguo',
        identification: '0999999999001',
      },
      totals: { tax: '13.04', grand: '100.00' },
      lines: [
        {
          position: 1,
          description: 'Filtro',
          quantity: '1',
          total_amount: '100.00',
          tax_rate: '15',
        },
      ],
      payments: [{ payment_code: '01', amount: '100.00' }],
    },
  })
  const { container } = renderPage()
  expect(screen.getByText('Cliente antiguo')).toBeVisible()
  expect(screen.getByText('15 %')).toBeVisible()
  expect(screen.getByText(/01 · USD 100\.00/)).toBeVisible()
  expect(screen.queryByText('Información avanzada')).toBeNull()
  expectNoForbiddenFiscalTerms(container)
})

const FORMAT_THREE_LINE = {
  position: 1,
  item_code: 'SRV-000012',
  description: 'Reparación de caja',
  quantity: '1',
  total_amount: '25.00',
  display_name: 'IVA 0 %',
}

it('shows the structured issuer of a format-3 preparation', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    payment_options: [],
    snapshot: {
      snapshot_format: 3,
      reference_date: '2026-10-05',
      issuer: {
        ruc: '1104018559001',
        legal_name: 'Jiménez Juan Alberto',
        tax_profile: {
          regime: 'GENERAL',
          accounting_obligation: 'NO',
          artisan_qualification: {
            number: 'JNDA-12345',
            issuing_body: 'Junta Nacional de Defensa del Artesano',
            ends_on: '2028-05-31',
          },
        },
      },
      receiver: { legal_name: 'Cliente', identification: '0999999999001' },
      totals: { tax: '0.00', grand: '25.00' },
      lines: [FORMAT_THREE_LINE],
      payments: [{ payment_code: '01', amount: '25.00' }],
      legends: [],
    },
  })
  const { container } = renderPage()

  const issuer = screen.getByLabelText('Emisor preparado')
  expect(issuer).toHaveTextContent('Régimen')
  expect(issuer).toHaveTextContent('General')
  expect(issuer).toHaveTextContent('Obligado a llevar contabilidad')
  expect(issuer).toHaveTextContent('No')
  expect(issuer).toHaveTextContent('JNDA-12345 · vence 2028-05-31')
  expect(screen.getByText('SRV-000012')).toBeVisible()
  expectNoForbiddenFiscalTerms(container)
})

it('shows the RIMPE legend and the designation numbers only when they apply', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    payment_options: [],
    snapshot: {
      snapshot_format: 3,
      reference_date: '2026-10-05',
      issuer: {
        tax_profile: {
          regime: 'RIMPE_EMPRENDEDOR',
          regime_legend: 'CONTRIBUYENTE RÉGIMEN RIMPE',
          accounting_obligation: 'SI',
          withholding_agent_resolution: '12345',
        },
      },
      receiver: {},
      totals: {},
      lines: [],
      payments: [],
      legends: [],
    },
  })
  renderPage()
  const issuer = screen.getByLabelText('Emisor preparado')
  expect(issuer).toHaveTextContent('RIMPE Emprendedor')
  expect(issuer).toHaveTextContent('CONTRIBUYENTE RÉGIMEN RIMPE')
  expect(issuer).toHaveTextContent('Agente de retención')
  expect(issuer).toHaveTextContent('12345')
  expect(issuer).not.toHaveTextContent('Contribuyente especial')
  expect(issuer).not.toHaveTextContent('Calificación artesanal')
})

it('shows the text legends of an earlier preparation instead of inventing an issuer profile', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    payment_options: [],
    snapshot: {
      snapshot_format: 2,
      reference_date: '2026-09-20',
      issuer: { ruc: '1104018559001', legal_name: 'Taller' },
      receiver: { legal_name: 'Cliente antiguo' },
      totals: {},
      lines: [],
      payments: [],
      legends: ['special_taxpayer: 12345'],
    },
  })
  renderPage()
  const issuer = screen.getByLabelText('Emisor preparado')
  expect(issuer).toHaveTextContent('special_taxpayer: 12345')
  expect(issuer).not.toHaveTextContent('Régimen')
})

it('omits the issuer section of a preparation that never kept conditions', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    payment_options: [],
    snapshot: {
      schema_version: 'factura-2.1.0',
      reference_date: '2026-09-20',
      receiver: { legal_name: 'Cliente antiguo' },
      totals: {},
      lines: [],
      payments: [],
    },
  })
  renderPage()
  expect(screen.queryByLabelText('Emisor preparado')).toBeNull()
})

it('explains the new line limits and rate rule with the text of the server', () => {
  mocks.review.data = {
    review_token: null,
    impediments: [
      {
        field: 'line[1].item_code',
        code: 'line_text_limit',
        audience: 'ADMINISTRATOR',
        message:
          'El código «CCCC…» de «Filtro» tiene 31 caracteres y el comprobante admite hasta 25. Corrija el producto o servicio en el catálogo.',
      },
      {
        field: 'line[2].artisan_rate',
        code: 'line_zero_rate_required',
        audience: 'ADMINISTRATOR',
        message:
          'La calificación artesanal declarada exige IVA 0 %, pero esta línea usa «IVA 15 %».',
      },
    ],
  }
  renderPage()
  const admin = screen.getByRole('list', {
    name: 'Debe resolverlo el Administrador',
  })
  expect(within(admin).getByText(/tiene 31 caracteres/)).toBeVisible()
  expect(within(admin).getByText(/exige IVA 0 %/)).toBeVisible()
  expect(
    screen.queryByRole('list', { name: 'Puede completarlo aquí' }),
  ).toBeNull()
})

// --- Datos del comprobante (DP-035) --------------------------------------------------------------

function withWorking(
  working: Partial<NonNullable<FiscalPreparationDetail['working']>>,
  overrides: Partial<FiscalPreparationDetail> = {},
) {
  const base = detail()
  mocks.preparation.data = {
    ...base,
    ...overrides,
    working: { ...base.working!, ...working },
  }
}

async function review(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: 'Revisar datos para facturación' }),
  )
}

function sentData() {
  return mocks.updateDraft.mutateAsync.mock.calls[0]![0].data
}

it('pide el correo del receptor y lo envía junto con el resto, sin tocar la ficha del cliente', async () => {
  const user = userEvent.setup()
  mocks.updateDraft.mutateAsync.mockResolvedValue({})
  renderPage()
  expect(
    within(screen.getByRole('region', { name: 'Receptor' })).getByLabelText(
      'Correo',
    ),
  ).toBeRequired()
  await user.type(screen.getByLabelText('Correo'), 'cliente@example.com')
  await review(user)
  expect(sentData().receiver.email).toBe('cliente@example.com')
})

it('muestra el correo que ya tiene el receptor sin pedirlo de nuevo', () => {
  withWorking(
    {
      receiver: {
        identification_type: '04',
        identification: '0999999999001',
        legal_name: 'Cliente Fiscal S.A.',
        email: 'ya@example.com',
      },
    },
    { missing_fields: ['address'] },
  )
  renderPage()
  const receiver = screen.getByRole('region', { name: 'Receptor' })
  expect(within(receiver).getByText('ya@example.com')).toBeVisible()
  expect(within(receiver).queryByLabelText('Correo')).toBeNull()
})

it('consumidor final no muestra ni pide el correo', async () => {
  const user = userEvent.setup()
  const base = detail()
  mocks.preparation.data = {
    ...base,
    summary: { ...base.summary!, grand_total: '30.00' },
  }
  renderPage()
  await user.click(
    screen.getByRole('checkbox', {
      name: /Preparar a nombre de consumidor final/,
    }),
  )
  const receiver = screen.getByRole('region', { name: 'Receptor' })
  expect(within(receiver).queryByLabelText('Correo')).toBeNull()
})

it('no ofrece el plazo cuando el servidor no lo pide', () => {
  renderPage()
  expect(screen.queryByLabelText('Plazo en días')).toBeNull()
})

it('pide el plazo en días cuando la operación es a crédito con saldo pendiente y lo envía como número', async () => {
  const user = userEvent.setup()
  mocks.updateDraft.mutateAsync.mockResolvedValue({})
  withWorking(
    { term_required: true },
    { missing_fields: ['address', 'email', 'term_days'] },
  )
  renderPage()
  const payments = screen.getByRole('region', { name: 'Formas de pago' })
  const term = within(payments).getByLabelText('Plazo en días')
  expect(term).toBeRequired()
  await user.type(term, '30')
  await user.type(screen.getByLabelText('Correo'), 'cliente@example.com')
  await review(user)
  expect(sentData().payments).toEqual({
    forms: [
      { payment_code: '01', amount: '40.00' },
      { payment_code: '20', amount: '60.00' },
    ],
    term_days: 30,
  })
})

it('precarga el plazo guardado y no lo envía si el servidor ya no lo pide', async () => {
  const user = userEvent.setup()
  mocks.updateDraft.mutateAsync.mockResolvedValue({})
  withWorking({
    term_required: false,
    payments: {
      forms: [{ payment_code: '01', amount: '100.00' }],
      suggested: false,
      term_days: 15,
    },
  })
  renderPage()
  expect(screen.queryByLabelText('Plazo en días')).toBeNull()
  await user.type(screen.getByLabelText('Correo'), 'cliente@example.com')
  await review(user)
  expect(sentData().payments).toEqual({
    forms: [{ payment_code: '01', amount: '100.00' }],
  })
})

it('muestra junto al plazo el error del servidor', () => {
  withWorking({ term_required: true })
  mocks.updateDraft.isError = true
  mocks.updateDraft.error = new ProblemError(
    'El borrador contiene datos inválidos.',
    400,
    'validation_error',
    undefined,
    { 'payments.term_days': ['El plazo debe estar entre 1 y 9999 días.'] },
  )
  renderPage()
  const payments = screen.getByRole('region', { name: 'Formas de pago' })
  expect(
    within(payments).getByText('El plazo debe estar entre 1 y 9999 días.'),
  ).toBeVisible()
})

it('agrega, edita y quita datos adicionales con un modal y los envía como pares', async () => {
  const user = userEvent.setup()
  mocks.updateDraft.mutateAsync.mockResolvedValue({})
  renderPage()
  const section = screen.getByRole('region', { name: 'Detalle adicional' })
  await user.click(
    within(section).getByRole('button', { name: 'Añadir dato adicional' }),
  )
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nombre'), 'Vehículo')
  await user.type(within(dialog).getByLabelText('Valor'), 'Placa PCM4567')
  await user.click(within(dialog).getByRole('button', { name: 'Agregar dato' }))
  expect(within(section).getByText('Vehículo')).toBeVisible()
  expect(within(section).getByText('Placa PCM4567')).toBeVisible()

  await user.click(
    within(section).getByRole('button', { name: 'Editar Vehículo' }),
  )
  const editing = screen.getByRole('dialog')
  const value = within(editing).getByLabelText('Valor')
  await user.clear(value)
  await user.type(value, 'Placa ABC1234')
  await user.click(
    within(editing).getByRole('button', { name: 'Guardar dato' }),
  )
  expect(within(section).getByText('Placa ABC1234')).toBeVisible()

  await user.type(screen.getByLabelText('Correo'), 'cliente@example.com')
  await review(user)
  expect(sentData().additional_info).toEqual([
    { name: 'Vehículo', value: 'Placa ABC1234' },
  ])

  await user.click(
    within(section).getByRole('button', { name: 'Quitar Vehículo' }),
  )
  expect(within(section).queryByText('Vehículo')).toBeNull()
})

it('precarga los datos adicionales guardados y deja de ofrecer agregar al llegar a 12', () => {
  withWorking({
    additional_info: Array.from({ length: 12 }, (_, index) => ({
      name: `Dato ${index + 1}`,
      value: 'x',
    })),
  })
  renderPage()
  const section = screen.getByRole('region', { name: 'Detalle adicional' })
  expect(within(section).getByText('Dato 12')).toBeVisible()
  expect(
    within(section).getByRole('button', { name: 'Añadir dato adicional' }),
  ).toBeDisabled()
})

it('recuerda incluir solo lo necesario y muestra el error de un nombre reservado', () => {
  withWorking({
    additional_info: [{ name: 'RUC Proveedor', value: '123' }],
  })
  mocks.updateDraft.isError = true
  mocks.updateDraft.error = new ProblemError(
    'El borrador contiene datos inválidos.',
    400,
    'validation_error',
    undefined,
    {
      'additional_info[1].name': [
        '«RUC Proveedor» está reservado: el sistema lo agrega y no lo escribe el usuario.',
      ],
    },
  )
  renderPage()
  const section = screen.getByRole('region', { name: 'Detalle adicional' })
  expect(section).toHaveTextContent('solo lo necesario')
  expect(within(section).getByText(/está reservado/)).toBeVisible()
})

const ARTISAN_SUMMARY = {
  kind: 'ARTISAN' as const,
  internal_number: 'ART-SER-000004',
  operational_date: '2026-09-25',
  condition: 'CONTADO' as const,
  state: 'CONFIRMED',
  base_total: '25.00',
  tax_total: '0.00',
  grand_total: '25.00',
  lines: [
    { position: 1, description: 'Alineación', quantity: '1', total: '15.00' },
    { position: 2, description: 'Balanceo', quantity: '1', total: '10.00' },
  ],
}

it('una operación artesanal precarga el detalle de cada servicio y lo envía ajustado', async () => {
  const user = userEvent.setup()
  mocks.updateDraft.mutateAsync.mockResolvedValue({})
  withWorking(
    {
      service_details: [
        { position: 1, detail: 'eje delantero' },
        { position: 2, detail: '' },
      ],
    },
    {
      summary: ARTISAN_SUMMARY,
      source: { kind: 'ARTISAN', id: 4, version: 1 },
    },
  )
  renderPage()
  const section = screen.getByRole('region', { name: 'Detalle por servicio' })
  const first = within(section).getByLabelText('Detalle de Alineación')
  expect(first).toHaveValue('eje delantero')
  expect(first).toHaveAttribute('maxlength', '300')
  expect(within(section).getByLabelText('Detalle de Balanceo')).toHaveValue('')
  await user.clear(first)
  await user.type(first, 'eje delantero y trasero')
  await user.type(screen.getByLabelText('Correo'), 'cliente@example.com')
  await review(user)
  expect(sentData().service_details).toEqual([
    { position: 1, detail: 'eje delantero y trasero' },
    { position: 2, detail: '' },
  ])
})

it('una venta comercial no ofrece detalle por servicio ni lo envía', async () => {
  const user = userEvent.setup()
  mocks.updateDraft.mutateAsync.mockResolvedValue({})
  renderPage()
  expect(
    screen.queryByRole('region', { name: 'Detalle por servicio' }),
  ).toBeNull()
  await user.type(screen.getByLabelText('Correo'), 'cliente@example.com')
  await review(user)
  expect('service_details' in sentData()).toBe(false)
})

it('muestra junto al servicio el error del detalle que devuelve el servidor', () => {
  withWorking(
    { service_details: [{ position: 1, detail: 'x' }] },
    { summary: ARTISAN_SUMMARY },
  )
  mocks.updateDraft.isError = true
  mocks.updateDraft.error = new ProblemError(
    'El borrador contiene datos inválidos.',
    400,
    'validation_error',
    undefined,
    {
      'service_details[1].detail': [
        'El detalle admite hasta 300 caracteres; tiene 301.',
      ],
    },
  )
  renderPage()
  const section = screen.getByRole('region', { name: 'Detalle por servicio' })
  expect(within(section).getByText(/tiene 301/)).toBeVisible()
})

it('una preparación completada muestra correo, plazo, datos adicionales y detalle de servicio solo si existen', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    payment_options: [],
    summary: ARTISAN_SUMMARY,
    snapshot: {
      snapshot_format: 4,
      reference_date: '2026-11-01',
      issuer: {
        ruc: '1104018559001',
        legal_name: 'Jiménez Juan Alberto',
        trade_name: 'Taller Ana',
        address: 'Matriz del taller',
        establishment_address: 'Local del taller',
        tax_profile: {
          regime: 'RIMPE_NEGOCIO_POPULAR',
          regime_legend: 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
          accounting_obligation: 'NO',
          large_taxpayer_resolution: 'NAC-GCFOIOC21-00000868-E',
        },
      },
      receiver: {
        legal_name: 'Cliente',
        identification: '0999999999001',
        email: 'cliente@example.com',
      },
      totals: { tax: '0.00', grand: '25.00' },
      lines: [
        {
          position: 1,
          item_code: 'SRV-000012',
          description: 'Alineación',
          quantity: '1',
          total_amount: '15.00',
          display_name: 'IVA 0 %',
          service_detail: 'eje delantero',
        },
        {
          position: 2,
          item_code: 'SRV-000013',
          description: 'Balanceo',
          quantity: '1',
          total_amount: '10.00',
          display_name: 'IVA 0 %',
        },
      ],
      payments: [
        { payment_code: '01', amount: '5.00' },
        {
          payment_code: '20',
          amount: '20.00',
          term_days: 30,
          time_unit: 'dias',
        },
      ],
      additional_info: [{ name: 'Vehículo', value: 'Placa PCM4567' }],
      legends: [],
    },
  })
  const { container } = renderPage()
  expect(screen.getByText('cliente@example.com')).toBeVisible()
  const issuer = screen.getByLabelText('Emisor preparado')
  expect(issuer).toHaveTextContent('Taller Ana')
  expect(issuer).toHaveTextContent('Local del taller')
  expect(issuer).toHaveTextContent('NAC-GCFOIOC21-00000868-E')
  expect(issuer).toHaveTextContent(
    'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
  )
  expect(screen.getByText('eje delantero')).toBeVisible()
  const payments = screen.getByLabelText('Formas de pago preparadas')
  expect(payments).toHaveTextContent('plazo 30 días')
  expect(payments.textContent?.match(/plazo/g)).toHaveLength(1)
  const extra = screen.getByLabelText('Detalle adicional preparado')
  expect(extra).toHaveTextContent('Vehículo')
  expect(extra).toHaveTextContent('Placa PCM4567')
  expectNoForbiddenFiscalTerms(container)
})

it('una preparación del formato 3 no muestra campos nuevos vacíos', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    working: null,
    payment_options: [],
    snapshot: {
      snapshot_format: 3,
      reference_date: '2026-10-05',
      issuer: {
        ruc: '1104018559001',
        legal_name: 'Jiménez Juan Alberto',
        tax_profile: { regime: 'GENERAL', accounting_obligation: 'NO' },
      },
      receiver: { legal_name: 'Cliente', identification: '0999999999001' },
      totals: { tax: '0.00', grand: '25.00' },
      lines: [FORMAT_THREE_LINE],
      payments: [{ payment_code: '01', amount: '25.00' }],
      legends: [],
    },
  })
  renderPage()
  expect(screen.queryByLabelText('Detalle adicional preparado')).toBeNull()
  expect(screen.queryByText(/plazo/)).toBeNull()
  expect(screen.queryByText('Nombre comercial')).toBeNull()
  expect(screen.queryByText('Gran contribuyente')).toBeNull()
  expect(screen.queryByText('Correo')).toBeNull()
})

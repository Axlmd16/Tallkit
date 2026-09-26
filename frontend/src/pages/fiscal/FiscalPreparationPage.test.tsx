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
      draft_format: 2,
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
    missing_fields: ['address'],
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
      },
      payments: {
        forms: [
          { payment_code: '01', amount: '40.00' },
          { payment_code: '20', amount: '60.00' },
        ],
      },
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

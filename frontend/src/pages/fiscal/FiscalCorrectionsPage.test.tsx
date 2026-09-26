import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: {
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    data: [
      {
        request_id: 'c1',
        action: 'ONLINE_CANCELLATION',
        state: 'DRAFT',
        version: 1,
        reason: 'Evaluar anulación',
        reference_date: '2026-09-26',
        requested_total: '10.00',
        evaluation_outcome: 'PENDING',
        has_evidence: false,
        reconciliation_pending: true,
        officially_executed: false,
      },
    ],
  },
  detail: {
    isPending: false,
    isError: false,
    data: null as Record<string, unknown> | null,
  },
  prepare: { mutate: vi.fn(), isPending: false, isError: false, error: null },
  cancel: { mutate: vi.fn(), isPending: false, isError: false, error: null },
  create: { mutate: vi.fn(), isPending: false, isError: false, error: null },
}))

vi.mock('@/features/fiscal/hooks', () => ({
  useCorrections: () => mocks.list,
  useCorrection: (id: string | null) => {
    if (id && !mocks.detail.data) {
      mocks.detail.data = {
        ...mocks.list.data[0],
        original: { kind: 'DOSSIER', id: 'd1' },
        normative_version: 'norma-v1',
        facts: {},
        evaluation: {
          outcome: 'PENDING',
          pending_facts: ['calendario completo'],
          reasons: ['Falta comprobar el calendario'],
        },
        requested_base: '10.00',
        requested_tax: '0.00',
        lines: [],
        evidence_dossier_id: null,
        cancellation_reason: '',
        replaces_id: null,
      }
    }
    return mocks.detail
  },
  useFiscalMutations: () => ({
    createCorrection: mocks.create,
    prepareCorrection: mocks.prepare,
    cancelCorrection: mocks.cancel,
  }),
}))

import { FiscalCorrectionsPage } from './FiscalCorrectionsPage'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.detail.data = null
  mocks.list.isPending = false
  mocks.list.isError = false
})

it('shows loading and retries persistent list errors', async () => {
  const user = userEvent.setup()
  mocks.list.isPending = true
  const { rerender } = render(<FiscalCorrectionsPage />)
  expect(screen.getByText('Cargando solicitudes fiscales…')).toBeInTheDocument()

  mocks.list.isPending = false
  mocks.list.isError = true
  rerender(<FiscalCorrectionsPage />)
  expect(
    screen.getByText('No se pudieron cargar las solicitudes fiscales.'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Reintentar/ }))
  expect(mocks.list.refetch).toHaveBeenCalledOnce()
})

it('shows local status and persistent pending facts without claiming official execution', async () => {
  const user = userEvent.setup()
  render(<FiscalCorrectionsPage />)
  expect(screen.getByText('Sin ejecución oficial')).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: /Solicitud de anulación/ }),
  )
  expect(screen.getByText('calendario completo')).toBeInTheDocument()
  expect(screen.getByText('Conciliación pendiente')).toBeInTheDocument()
  expect(screen.getByText('No ejecutada')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Preparar localmente' }),
  ).toBeDisabled()
})

it('cancels with the selected request version and preserves entered reason', async () => {
  const user = userEvent.setup()
  render(<FiscalCorrectionsPage />)
  await user.click(
    screen.getByRole('button', { name: /Solicitud de anulación/ }),
  )
  await user.type(
    screen.getByLabelText('Motivo de cancelación local'),
    'Datos incompletos',
  )
  await user.click(screen.getByRole('button', { name: 'Cancelar solicitud' }))
  expect(mocks.cancel.mutate).toHaveBeenCalledWith({
    requestId: 'c1',
    version: 1,
    reason: 'Datos incompletos',
  })
})

it('registers a local cancellation request while preserving unknown facts', async () => {
  const user = userEvent.setup()
  render(<FiscalCorrectionsPage />)
  await user.click(screen.getByText('Registrar solicitud local'))
  await user.type(
    screen.getByLabelText('Identificador del original'),
    '11111111-1111-4111-8111-111111111111',
  )
  await user.type(screen.getByLabelText('Fecha de referencia'), '2026-09-26')
  await user.type(screen.getByLabelText('Motivo'), 'Error de datos')
  await user.click(screen.getByRole('button', { name: 'Registrar borrador' }))

  expect(mocks.create.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      attemptKey: expect.any(String),
      data: expect.objectContaining({
        original_dossier_id: '11111111-1111-4111-8111-111111111111',
        original_identity_id: null,
        action: 'ONLINE_CANCELLATION',
        reason: 'Error de datos',
        reference_date: '2026-09-26',
        lines: [],
        facts: expect.objectContaining({
          consumer_final_transmitted: null,
          holidays_complete: false,
        }),
      }),
    }),
  )
})

it('prepares an eligible local request with its current version', async () => {
  const user = userEvent.setup()
  mocks.detail.data = {
    ...mocks.list.data[0],
    original: { kind: 'DOSSIER', id: 'd1' },
    normative_version: 'norma-v1',
    facts: {},
    evaluation: { outcome: 'ELIGIBLE', pending_facts: [], reasons: [] },
    requested_base: '10.00',
    requested_tax: '0.00',
    lines: [],
    evidence_dossier_id: null,
    cancellation_reason: '',
    replaces_id: null,
  }
  render(<FiscalCorrectionsPage />)
  await user.click(
    screen.getByRole('button', { name: /Solicitud de anulación/ }),
  )
  await user.click(screen.getByRole('button', { name: 'Preparar localmente' }))
  expect(mocks.prepare.mutate).toHaveBeenCalledWith({
    requestId: 'c1',
    version: 1,
  })
})

it('builds a credit-note line and known review facts', async () => {
  const user = userEvent.setup()
  render(<FiscalCorrectionsPage />)
  await user.click(screen.getByText('Registrar solicitud local'))
  await user.selectOptions(
    screen.getByLabelText('Acción solicitada'),
    'CREDIT_NOTE',
  )
  await user.selectOptions(
    screen.getByLabelText('Consumidor final transmitido'),
    'false',
  )
  await user.type(
    screen.getByLabelText('Identificador del original'),
    '11111111-1111-4111-8111-111111111111',
  )
  await user.type(screen.getByLabelText('Fecha de referencia'), '2026-09-26')
  await user.type(screen.getByLabelText('Motivo'), 'Devolución parcial')
  await user.type(screen.getByLabelText('Posición'), '1')
  await user.type(screen.getByLabelText('Cantidad'), '1.000000')
  await user.type(screen.getByLabelText('Base'), '10.00')
  await user.type(screen.getByLabelText('Impuesto'), '0.00')
  await user.type(screen.getByLabelText('Total'), '10.00')
  await user.click(screen.getByLabelText(/Calendario completo/))
  await user.click(screen.getByRole('button', { name: 'Registrar borrador' }))

  expect(mocks.create.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        action: 'CREDIT_NOTE',
        facts: expect.objectContaining({
          consumer_final_transmitted: false,
          holidays_complete: true,
        }),
        lines: [
          {
            position: 1,
            quantity: '1.000000',
            base_amount: '10.00',
            tax_amount: '0.00',
            total_amount: '10.00',
          },
        ],
      }),
    }),
  )
})

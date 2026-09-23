import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({
  status: { data: undefined, isPending: false, isError: false } as Record<
    string,
    unknown
  >,
  registerPayment: vi.fn(),
  correctPayment: vi.fn(),
  registerReturn: vi.fn(),
  registerRefund: vi.fn(),
  void: vi.fn(),
  paymentPreview: vi.fn(),
  correctionPreview: vi.fn(),
  returnPreview: vi.fn(),
  refundPreview: vi.fn(),
  voidPreview: vi.fn(),
}))

vi.mock('./hooks', () => ({
  useOperationStatus: () => mocks.status,
  useSaleMutations: () => ({
    registerPayment: { mutateAsync: mocks.registerPayment },
    correctPayment: { mutateAsync: mocks.correctPayment },
    registerReturn: { mutateAsync: mocks.registerReturn },
    registerRefund: { mutateAsync: mocks.registerRefund },
    void: { mutateAsync: mocks.void },
  }),
}))
vi.mock('./api', () => ({
  salesApi: {
    paymentPreview: (...a: unknown[]) => mocks.paymentPreview(...a),
    correctionPreview: (...a: unknown[]) => mocks.correctionPreview(...a),
    returnPreview: (...a: unknown[]) => mocks.returnPreview(...a),
    refundPreview: (...a: unknown[]) => mocks.refundPreview(...a),
    voidPreview: (...a: unknown[]) => mocks.voidPreview(...a),
  },
}))

import { CorrectionDialog } from './CorrectionDialog'
import { clearMoneyIntents, intentKey, peekIntent } from './moneyIntent'
import { PaymentDialog } from './PaymentDialog'
import { RefundDialog } from './RefundDialog'
import { ReturnDialog } from './ReturnDialog'
import type { Sale, SalePaymentRow, SaleReturnRow } from './types'
import { VoidSaleDialog } from './VoidSaleDialog'

const sale = {
  id: 7,
  version: 3,
  state: 'CONFIRMED',
  condition: 'CONTADO',
  money: {
    balance: '100.00',
    applied: '100.00',
    refund_due: '40.00',
    payment_state: 'PENDING',
  },
  lines: [
    {
      id: 11,
      position: 1,
      product_id: 5,
      product_code: 'ACE-1',
      product_name: 'Aceite',
      quantity: '5',
      returned_quantity: '1',
    },
  ],
} as unknown as Sale

const okReview = (extra: Record<string, unknown> = {}) => ({
  sale_id: 7,
  version: 3,
  can_register: true,
  issues: [],
  review_token: 'tok',
  expires_in_seconds: 900,
  ...extra,
})

const common = {
  onClose: vi.fn(),
  onDone: vi.fn(),
  open: true,
  userScope: 'vendedor',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearMoneyIntents()
  window.sessionStorage.clear()
  mocks.status = { data: undefined, isPending: false, isError: false }
  mocks.paymentPreview.mockResolvedValue(okReview())
})

async function fillPayment(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Efectivo (USD)'), '40.00')
  await user.type(screen.getByLabelText('Transferencia (USD)'), '60.00')
}

it('el cobro combina medios, valida contra el saldo del servidor y explica contado', async () => {
  const user = userEvent.setup()
  mocks.registerPayment.mockResolvedValue({ id: 1 })
  render(<PaymentDialog sale={sale} {...common} />)
  expect(screen.getByText('Saldo pendiente: USD 100.00')).toBeInTheDocument()
  expect(
    screen.getByText(/de contado exige cubrir el saldo completo/),
  ).toBeInTheDocument()
  await user.type(screen.getByLabelText('Efectivo (USD)'), '10.001')
  expect(
    screen.getByText('Use un importe positivo con hasta 2 decimales.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revisar' })).toBeDisabled()
  await user.clear(screen.getByLabelText('Efectivo (USD)'))
  await fillPayment(user)
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.paymentPreview).toHaveBeenCalled())
  expect(mocks.paymentPreview.mock.calls[0]?.[1].parts).toEqual([
    { method: 'EFECTIVO', amount: '40.00' },
    { method: 'TRANSFERENCIA', amount: '60.00' },
  ])
  await user.click(
    await screen.findByRole('button', { name: 'Registrar cobro' }),
  )
  await waitFor(() => expect(common.onDone).toHaveBeenCalled())
  const sent = mocks.registerPayment.mock.calls[0]?.[0]
  expect(sent).toMatchObject({ id: 7, reviewToken: 'tok' })
  expect(sent.operationId).toMatch(/^[0-9a-f-]{36}$/)
  expect(peekIntent(intentKey('vendedor', 7, 'payment'))).toBeNull()
})

it('conserva el UUID en sessionStorage sin importes, motivo ni token', async () => {
  const user = userEvent.setup()
  render(<PaymentDialog sale={sale} {...common} />)
  await fillPayment(user)
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.paymentPreview).toHaveBeenCalled())
  const key = intentKey('vendedor', 7, 'payment')
  const stored = window.sessionStorage.getItem(key) as string
  expect(stored).toMatch(/^[0-9a-f-]{36}$/)
  const everything = JSON.stringify(Object.entries(window.sessionStorage))
  expect(everything).not.toMatch(/40\.00|60\.00|tok/)
})

it('evita el envío duplicado mientras el registro está en curso', async () => {
  const user = userEvent.setup()
  let release!: (value: unknown) => void
  mocks.registerPayment.mockReturnValue(
    new Promise((resolve) => (release = resolve)),
  )
  render(<PaymentDialog sale={sale} {...common} />)
  await fillPayment(user)
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  const submit = await screen.findByRole('button', { name: 'Registrar cobro' })
  await user.click(submit)
  const busy = await screen.findByRole('button', { name: 'Registrando…' })
  expect(busy).toBeDisabled()
  await user.click(busy)
  expect(mocks.registerPayment).toHaveBeenCalledTimes(1)
  release({ id: 1 })
})

it('ante un resultado incierto no afirma que el dinero no se entregó y reintenta el mismo hecho', async () => {
  const user = userEvent.setup()
  mocks.registerPayment
    .mockRejectedValueOnce(
      new ProblemError('sin respuesta', 0, 'network_error'),
    )
    .mockResolvedValueOnce({ id: 1 })
  render(<PaymentDialog sale={sale} {...common} />)
  await fillPayment(user)
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await user.click(
    await screen.findByRole('button', { name: 'Registrar cobro' }),
  )
  await screen.findByText('No recibimos la confirmación del servidor')
  expect(document.body).toHaveTextContent(
    'no indica si el dinero se entregó o no',
  )
  const before = window.sessionStorage.getItem(
    intentKey('vendedor', 7, 'payment'),
  )
  await user.click(
    screen.getByRole('button', { name: 'Reintentar el mismo registro' }),
  )
  await waitFor(() => expect(common.onDone).toHaveBeenCalled())
  const [first, second] = mocks.registerPayment.mock.calls.map((c) => c[0])
  expect(second.operationId).toBe(first.operationId)
  expect(second.key).toBe(first.key)
  expect(first.operationId).toBe(before)
})

it('al reabrir tras una recarga consulta el UUID: si existe, no ofrece otra operación', async () => {
  const key = intentKey('vendedor', 7, 'payment')
  window.sessionStorage.setItem(key, '11111111-1111-4111-8111-111111111111')
  mocks.status = {
    data: { kind: 'payment', id: 3 },
    isPending: false,
    isError: false,
  }
  render(<PaymentDialog sale={sale} {...common} />)
  await screen.findByText('Este registro ya se guardó')
  expect(screen.queryByRole('button', { name: 'Registrar cobro' })).toBeNull()
  await waitFor(() => expect(peekIntent(key)).toBeNull())
})

it('sin resultado registrado no afirma nada sobre el dinero y permite registrar el mismo hecho', async () => {
  const key = intentKey('vendedor', 7, 'payment')
  window.sessionStorage.setItem(key, '22222222-2222-4222-8222-222222222222')
  mocks.status = { data: undefined, isPending: false, isError: true }
  render(<PaymentDialog sale={sale} {...common} />)
  await screen.findByText('Hay un registro anterior sin resultado')
  expect(document.body).toHaveTextContent(
    'Eso no indica si el dinero se entregó o no',
  )
  expect(screen.getByRole('button', { name: 'Revisar' })).toBeInTheDocument()
  expect(peekIntent(key)).toBe('22222222-2222-4222-8222-222222222222')
})

it('errores del servidor se muestran en la acción y se vuelve a revisar sin reintento ciego', async () => {
  const user = userEvent.setup()
  mocks.registerPayment.mockRejectedValue(
    new ProblemError('La venta cambió', 409, 'review_required'),
  )
  render(<PaymentDialog sale={sale} {...common} />)
  await fillPayment(user)
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await user.click(
    await screen.findByRole('button', { name: 'Registrar cobro' }),
  )
  await screen.findByText('No se registró la operación')
  expect(mocks.registerPayment).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(mocks.paymentPreview).toHaveBeenCalledTimes(2))
})

const payment = {
  id: 9,
  amount: '100.00',
  operation_id: 'op',
  effective_date: '2026-09-20',
  parts: [],
  state: 'ACTIVE',
  correction: null,
} as SalePaymentRow

it('la corrección exige motivo, permite reemplazo opcional y explica la dependencia con reembolsos', async () => {
  const user = userEvent.setup()
  mocks.correctionPreview.mockResolvedValue(
    okReview({ can_correct: true, can_register: undefined }),
  )
  render(<CorrectionDialog payment={payment} sale={sale} {...common} />)
  expect(
    screen.getByText(/reembolso efectivo que depende de este pago/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revisar' })).toBeDisabled()
  await user.type(screen.getByLabelText('Motivo de la corrección'), '   ')
  expect(screen.getByText('El motivo es obligatorio.')).toBeInTheDocument()
  await user.clear(screen.getByLabelText('Motivo de la corrección'))
  await user.type(
    screen.getByLabelText('Motivo de la corrección'),
    'Medio equivocado',
  )
  expect(screen.queryByLabelText('Efectivo (USD)')).toBeNull()
  await user.click(screen.getByLabelText('Sustituir por un pago corregido'))
  expect(screen.getByLabelText('Efectivo (USD)')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Transferencia (USD)'), '100.00')
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.correctionPreview).toHaveBeenCalled())
  const body = mocks.correctionPreview.mock.calls[0]?.[2]
  expect(body.reason).toBe('Medio equivocado')
  expect(body.replacement.parts).toEqual([
    { method: 'TRANSFERENCIA', amount: '100.00' },
  ])
  expect(body.replacement.operationId).not.toBe(body.operationId)
})

it('la devolución muestra cantidades originales y devueltas y clasifica la aptitud por cantidad', async () => {
  const user = userEvent.setup()
  mocks.returnPreview.mockResolvedValue(
    okReview({ can_return: true, can_register: undefined }),
  )
  render(<ReturnDialog sale={sale} {...common} />)
  expect(
    screen.getByText(/Vendidas 5 · ya devueltas 1 · devolvibles 4/),
  ).toBeInTheDocument()
  await user.type(screen.getByLabelText('Aptas para reventa (línea 1)'), '2')
  await user.type(screen.getByLabelText('No aptas (línea 1)'), '1')
  expect(screen.getByRole('button', { name: 'Revisar' })).toBeDisabled() // falta el motivo
  await user.type(
    screen.getByLabelText('Motivo de la devolución'),
    'Producto equivocado',
  )
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.returnPreview).toHaveBeenCalled())
  expect(mocks.returnPreview.mock.calls[0]?.[1].lines).toEqual([
    { sale_line_id: 11, fit_quantity: '2', unfit_quantity: '1' },
  ])
})

it('el reembolso distingue registrar el hecho de entregar el dinero y acota el exceso', async () => {
  const saleReturn = {
    id: 4,
    grand_total: '40.00',
    reason: 'x',
    effective_date: '2026-09-20',
    operation_id: 'op',
  } as SaleReturnRow
  render(<RefundDialog saleReturn={saleReturn} sale={sale} {...common} />)
  expect(
    screen.getByText('Exceso pendiente de reembolso: USD 40.00'),
  ).toBeInTheDocument()
  expect(document.body).toHaveTextContent(
    'Registrar el hecho en el sistema es distinto de entregar el dinero',
  )
  expect(document.body).toHaveTextContent('no puede superar el exceso vigente')
  expect(document.body).toHaveTextContent(
    'no realiza la transferencia ni entrega el efectivo',
  )
})

it('la anulación con dinero captura el desembolso y explica cómo reintentar sin entregar otra vez', async () => {
  const user = userEvent.setup()
  mocks.voidPreview.mockResolvedValue(
    okReview({ can_void: true, can_register: undefined }),
  )
  render(<VoidSaleDialog sale={sale} {...common} />)
  expect(
    screen.getByText(
      /reintente el mismo registro; no entregue el dinero otra vez/,
    ),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Efectivo (USD)')).toBeInTheDocument()
  await user.type(
    screen.getByLabelText('Motivo de la anulación'),
    'Error de captura',
  )
  await user.type(screen.getByLabelText('Efectivo (USD)'), '100.00')
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.voidPreview).toHaveBeenCalled())
  const body = mocks.voidPreview.mock.calls[0]?.[1]
  expect(body.reason).toBe('Error de captura')
  expect(body.refund.parts).toEqual([{ method: 'EFECTIVO', amount: '100.00' }])
  expect(body.refund.operationId).toMatch(/^[0-9a-f-]{36}$/)
})

it('la anulación sin dinero no pide desembolso', () => {
  const noMoney = { ...sale, money: { ...sale.money, applied: '0.00' } } as Sale
  render(<VoidSaleDialog sale={noMoney} {...common} />)
  expect(screen.queryByLabelText('Efectivo (USD)')).toBeNull()
  expect(
    screen.getByText(/no tiene dinero recibido por devolver/),
  ).toBeInTheDocument()
})

it('el reembolso revisa y registra el desembolso con su UUID, partes y motivo', async () => {
  const user = userEvent.setup()
  const saleReturn = { id: 4, grand_total: '40.00' } as SaleReturnRow
  mocks.refundPreview.mockResolvedValue(okReview())
  mocks.registerRefund.mockResolvedValue({ id: 1 })
  render(<RefundDialog saleReturn={saleReturn} sale={sale} {...common} />)
  await user.type(screen.getByLabelText('Efectivo (USD)'), '40.00')
  await user.type(
    screen.getByLabelText('Motivo del reembolso'),
    'Devolución al cliente',
  )
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.refundPreview).toHaveBeenCalled())
  expect(mocks.refundPreview.mock.calls[0]?.[1]).toMatchObject({
    saleReturnId: 4,
    reason: 'Devolución al cliente',
    parts: [{ method: 'EFECTIVO', amount: '40.00' }],
  })
  await user.click(
    await screen.findByRole('button', { name: 'Registrar reembolso' }),
  )
  await waitFor(() => expect(common.onDone).toHaveBeenCalled())
  expect(mocks.registerRefund.mock.calls[0]?.[0]).toMatchObject({
    id: 7,
    reviewToken: 'tok',
  })
})

it('registra devolución, corrección y anulación con sus datos y cierra al terminar', async () => {
  const user = userEvent.setup()
  mocks.returnPreview.mockResolvedValue(
    okReview({ can_return: true, can_register: undefined }),
  )
  mocks.registerReturn.mockResolvedValue({ id: 1 })
  const first = render(<ReturnDialog sale={sale} {...common} />)
  await user.type(screen.getByLabelText('Aptas para reventa (línea 1)'), '1')
  await user.type(
    screen.getByLabelText('Motivo de la devolución'),
    'Equivocado',
  )
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await user.click(
    await screen.findByRole('button', { name: 'Registrar devolución' }),
  )
  await waitFor(() => expect(mocks.registerReturn).toHaveBeenCalled())
  first.unmount()

  mocks.correctionPreview.mockResolvedValue(
    okReview({ can_correct: true, can_register: undefined }),
  )
  mocks.correctPayment.mockResolvedValue({ id: 9 })
  const second = render(
    <CorrectionDialog payment={payment} sale={sale} {...common} />,
  )
  await user.type(screen.getByLabelText('Motivo de la corrección'), 'Error')
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await user.click(await screen.findByRole('button', { name: 'Corregir pago' }))
  await waitFor(() => expect(mocks.correctPayment).toHaveBeenCalled())
  second.unmount()

  mocks.voidPreview.mockResolvedValue(
    okReview({ can_void: true, can_register: undefined }),
  )
  mocks.void.mockResolvedValue({ id: 7 })
  render(
    <VoidSaleDialog
      sale={{ ...sale, money: { ...sale.money, applied: '0.00' } } as Sale}
      {...common}
    />,
  )
  await user.type(
    screen.getByLabelText('Motivo de la anulación'),
    'Error de captura',
  )
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await user.click(await screen.findByRole('button', { name: 'Anular venta' }))
  await waitFor(() => expect(mocks.void).toHaveBeenCalled())
  expect(mocks.void.mock.calls[0]?.[0]).toMatchObject({
    id: 7,
    expectedVersion: 3,
    reason: 'Error de captura',
  })
})

it('«Consultar estado» vuelve a consultar el UUID pendiente sin ofrecer otra operación', async () => {
  const user = userEvent.setup()
  mocks.registerPayment.mockRejectedValue(
    new ProblemError('sin respuesta', 0, 'network_error'),
  )
  render(<PaymentDialog sale={sale} {...common} />)
  await fillPayment(user)
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await user.click(
    await screen.findByRole('button', { name: 'Registrar cobro' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Consultar estado' }),
  )
  expect(
    screen.getByText('No recibimos la confirmación del servidor'),
  ).toBeInTheDocument()
  expect(mocks.registerPayment).toHaveBeenCalledTimes(1)
})

it('anular es una acción de peligro con una salida segura que nombra lo que se conserva', () => {
  render(
    <VoidSaleDialog
      sale={{ ...sale, money: { ...sale.money, applied: '0.00' } } as Sale}
      {...common}
    />,
  )
  const dialog = screen.getByRole('dialog', { name: 'Anular venta' })
  expect(dialog).toHaveAttribute('data-tone', 'danger')
  expect(
    screen.getByRole('button', { name: 'Conservar venta' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Anular venta' }).className,
  ).toMatch(/\bbg-danger\b/)
})

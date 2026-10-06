import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  registerPayment: vi.fn(),
  paymentPreview: vi.fn(),
}))

vi.mock('./hooks', () => ({
  useOperationStatus: () => ({
    data: undefined,
    isPending: false,
    isError: false,
  }),
  useSaleMutations: () => ({
    registerPayment: { mutateAsync: mocks.registerPayment },
  }),
}))
vi.mock('./api', () => ({
  salesApi: {
    paymentPreview: (...a: unknown[]) => mocks.paymentPreview(...a),
  },
}))

import { clearMoneyIntents } from './moneyIntent'
import { PaymentDialog } from './PaymentDialog'
import type { Sale } from './types'
import {
  emptyWithholding,
  remainingAfter,
  settlementValid,
  toWithholding,
} from './WithholdingQuestion'

const baseSale = {
  id: 7,
  version: 3,
  internal_number: 'COM-VEN-000007',
  state: 'CONFIRMED',
  condition: 'CONTADO',
  money: { balance: '250.00', payment_state: 'PENDING' },
  lines: [],
  withholding_context: { enabled: true, customer_is_agent: false },
} as unknown as Sale

const review = (extra: Record<string, unknown> = {}) => ({
  sale_id: 7,
  version: 3,
  can_register: true,
  issues: [],
  review_token: 'tok',
  expires_in_seconds: 900,
  warning: null,
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
  mocks.paymentPreview.mockResolvedValue(review())
  mocks.registerPayment.mockResolvedValue({ id: 1 })
})

it('calcula lo que falta y valida el cobro con dinero, retención o ambos', () => {
  expect(remainingAfter('250.00', '', '245.00')).toBe('5.00')
  expect(remainingAfter('250.00', '100.50', '100')).toBe('49.50')
  expect(remainingAfter('250.00', '300', '')).toBe('0.00')
  expect(remainingAfter('250.00', 'x', '')).toBe('250.00')
  expect(settlementValid('', '', emptyWithholding)).toBe(false)
  expect(settlementValid('245', '', emptyWithholding)).toBe(true)
  const held = { active: true, amount: '5.00', acknowledged: false }
  expect(settlementValid('', '', held)).toBe(true)
  expect(settlementValid('245.00', '', held)).toBe(true)
  expect(settlementValid('', '', { ...held, amount: '0' })).toBe(false)
  expect(toWithholding(emptyWithholding)).toBeNull()
  expect(toWithholding(held)).toEqual({ amount: '5.00' })
  expect(toWithholding({ ...held, acknowledged: true })).toEqual({
    amount: '5.00',
    acknowledged: true,
  })
})

it('no pregunta por la retención hasta que falta dinero y nunca pide el comprobante', async () => {
  const user = userEvent.setup()
  render(<PaymentDialog sale={baseSale} {...common} />)
  expect(screen.queryByTestId('payment-withholding')).not.toBeInTheDocument()

  await user.type(screen.getByLabelText('Transferencia (USD)'), '245.00')
  expect(
    screen.getByText(/Sí, el cliente retuvo los USD 5.00 que faltan/),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText(/comprobante/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/renta|IVA/i)).not.toBeInTheDocument()
})

it('confirma la diferencia como retención y la envía junto al dinero', async () => {
  const user = userEvent.setup()
  render(<PaymentDialog sale={baseSale} {...common} />)
  await user.type(screen.getByLabelText('Transferencia (USD)'), '245.00')
  await user.click(screen.getByRole('checkbox', { name: /el cliente retuvo/ }))
  expect(screen.getByLabelText('Valor retenido (USD)')).toHaveValue('5.00')

  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.paymentPreview).toHaveBeenCalled())
  expect(mocks.paymentPreview.mock.calls[0]?.[1]).toMatchObject({
    parts: [{ method: 'TRANSFERENCIA', amount: '245.00' }],
    withholding: { amount: '5.00' },
  })
  await user.click(
    await screen.findByRole('button', { name: 'Registrar cobro' }),
  )
  await waitFor(() => expect(mocks.registerPayment).toHaveBeenCalled())
  expect(mocks.registerPayment.mock.calls[0]?.[0]).toMatchObject({
    withholding: { amount: '5.00' },
    reviewToken: 'tok',
  })
})

it('dejar la diferencia como saldo no envía ninguna retención', async () => {
  const user = userEvent.setup()
  const credit = { ...baseSale, condition: 'CREDITO' } as Sale
  render(<PaymentDialog sale={credit} {...common} />)
  await user.type(screen.getByLabelText('Efectivo (USD)'), '100')
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.paymentPreview).toHaveBeenCalled())
  expect(mocks.paymentPreview.mock.calls[0]?.[1]).toMatchObject({
    parts: [{ method: 'EFECTIVO', amount: '100' }],
    withholding: null,
  })
})

it('con el cliente marcado ofrece la retención desde el inicio y admite retención sola', async () => {
  const user = userEvent.setup()
  const marked = {
    ...baseSale,
    money: { balance: '5.00', payment_state: 'PARTIAL' },
    withholding_context: { enabled: true, customer_is_agent: true },
  } as unknown as Sale
  render(<PaymentDialog sale={marked} {...common} />)
  expect(
    screen.getByText(/marcado como agente de retención/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revisar' })).toBeDisabled()

  await user.click(screen.getByRole('checkbox', { name: /el cliente retuvo/ }))
  expect(screen.getByLabelText('Valor retenido (USD)')).toHaveValue('5.00')
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.paymentPreview).toHaveBeenCalled())
  expect(mocks.paymentPreview.mock.calls[0]?.[1]).toMatchObject({
    parts: [],
    withholding: { amount: '5.00' },
  })
})

it('una entidad que no registra retenciones no ofrece la pregunta', async () => {
  const user = userEvent.setup()
  const disabled = {
    ...baseSale,
    withholding_context: { enabled: false, customer_is_agent: true },
  } as unknown as Sale
  render(<PaymentDialog sale={disabled} {...common} />)
  await user.type(screen.getByLabelText('Transferencia (USD)'), '245.00')
  expect(screen.queryByTestId('payment-withholding')).not.toBeInTheDocument()
})

it('una retención inusual exige confirmación antes de registrar', async () => {
  const user = userEvent.setup()
  mocks.paymentPreview.mockResolvedValueOnce(
    review({
      can_register: false,
      review_token: null,
      warning: { percentage: '20.00', threshold: '50.00' },
      issues: [
        {
          code: 'withholding_warning',
          field: 'withholding',
          message: 'La retención supera el 20.00 % del total.',
        },
      ],
    }),
  )
  render(<PaymentDialog sale={baseSale} {...common} />)
  await user.type(screen.getByLabelText('Efectivo (USD)'), '150.00')
  await user.click(screen.getByRole('checkbox', { name: /el cliente retuvo/ }))
  await user.click(screen.getByRole('button', { name: 'Revisar' }))

  const confirm = await screen.findByRole('checkbox', {
    name: 'Confirmo que el valor retenido es correcto',
  })
  expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeDisabled()
  await user.click(confirm)
  await user.click(screen.getByRole('button', { name: 'Revisar' }))
  await waitFor(() => expect(mocks.paymentPreview).toHaveBeenCalledTimes(2))
  expect(mocks.paymentPreview.mock.calls[1]?.[1]).toMatchObject({
    withholding: { amount: '100.00', acknowledged: true },
  })
})

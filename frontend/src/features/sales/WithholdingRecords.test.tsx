import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import type { Withholding } from './types'
import {
  VoidWithholdingDialog,
  VoucherDialog,
  WithholdingList,
} from './WithholdingRecords'

const pending: Withholding = {
  id: 3,
  operation_id: 'a',
  payment_id: 1,
  amount: '5.00',
  effective_at: '2026-10-05T10:00:00Z',
  effective_date: '2026-10-05',
  state: 'ACTIVE',
  void_reason: null,
  voided_at: null,
  voucher_pending: true,
  voucher_number: null,
  voucher_date: null,
  income_tax_amount: null,
  vat_amount: null,
}
const completed: Withholding = {
  ...pending,
  id: 4,
  voucher_pending: false,
  voucher_number: '001-001-000028564',
  voucher_date: '2026-10-05',
  income_tax_amount: '5.00',
  vat_amount: '0.00',
}
const voided: Withholding = {
  ...pending,
  id: 5,
  state: 'VOIDED',
  voucher_pending: false,
  void_reason: 'Registrada por error',
}

const handlers = () => ({
  onComplete: vi.fn(),
  onCorrect: vi.fn(),
  onVoid: vi.fn(),
})

it('muestra la situación de cada retención y solo las acciones permitidas', async () => {
  const user = userEvent.setup()
  const admin = handlers()
  const { rerender } = render(
    <WithholdingList
      canAdmin
      canComplete
      withholdings={[pending, completed, voided]}
      {...admin}
    />,
  )
  const first = screen.getByRole('listitem', { name: 'Retención 3' })
  expect(within(first).getByText('Comprobante pendiente')).toBeInTheDocument()
  await user.click(
    within(first).getByRole('button', { name: 'Completar comprobante' }),
  )
  expect(admin.onComplete).toHaveBeenCalledWith(pending, expect.anything())

  const second = screen.getByRole('listitem', { name: 'Retención 4' })
  expect(
    within(second).getByText('Comprobante 001-001-000028564'),
  ).toBeInTheDocument()
  expect(within(second).getByText(/Renta USD 5.00/)).toBeInTheDocument()
  expect(
    within(second).queryByRole('button', { name: 'Completar comprobante' }),
  ).toBeNull()
  await user.click(
    within(second).getByRole('button', { name: 'Corregir comprobante' }),
  )
  expect(admin.onCorrect).toHaveBeenCalled()

  const third = screen.getByRole('listitem', { name: 'Retención 5' })
  expect(within(third).getByText('Anulada')).toBeInTheDocument()
  expect(within(third).getByText(/Registrada por error/)).toBeInTheDocument()
  expect(within(third).queryByRole('button')).toBeNull()

  rerender(
    <WithholdingList
      canAdmin={false}
      canComplete
      withholdings={[pending, completed]}
      {...handlers()}
    />,
  )
  expect(screen.queryByRole('button', { name: 'Anular retención' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Corregir comprobante' }),
  ).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Completar comprobante' }),
  ).toBeInTheDocument()
})

it('completa el comprobante con número, fecha y desglose opcional', async () => {
  const user = userEvent.setup()
  const submit = vi.fn().mockResolvedValue({})
  const done = vi.fn()
  render(
    <VoucherDialog
      onClose={vi.fn()}
      onDone={done}
      onSubmit={submit}
      scope="artesanal"
      withholding={pending}
    />,
  )
  const dialog = screen.getByRole('dialog')
  expect(
    within(dialog).getByLabelText('Negocio: Servicios'),
  ).toBeInTheDocument()
  const save = within(dialog).getByRole('button', {
    name: 'Guardar comprobante',
  })
  expect(save).toBeDisabled()

  await user.type(
    within(dialog).getByLabelText('Número del comprobante'),
    '1-1-1',
  )
  expect(
    within(dialog).getByText('Use el formato 001-001-000000001.'),
  ).toBeInTheDocument()
  await user.clear(within(dialog).getByLabelText('Número del comprobante'))
  await user.type(
    within(dialog).getByLabelText('Número del comprobante'),
    '001-001-000028564',
  )
  await user.type(
    within(dialog).getByLabelText('Retención de renta (USD)'),
    '5.00',
  )
  expect(save).toBeDisabled()
  await user.type(within(dialog).getByLabelText('Retención de IVA (USD)'), '0')
  await user.click(save)

  await waitFor(() => expect(submit).toHaveBeenCalled())
  expect(submit.mock.calls[0]?.[0]).toMatchObject({
    voucherNumber: '001-001-000028564',
    incomeTaxAmount: '5.00',
    vatAmount: '0',
  })
  expect(done).toHaveBeenCalledWith('Comprobante de retención completado.')
})

it('la corrección exige motivo y parte de los datos anteriores', async () => {
  const user = userEvent.setup()
  const submit = vi.fn().mockResolvedValue({})
  render(
    <VoucherDialog
      correcting
      onClose={vi.fn()}
      onDone={vi.fn()}
      onSubmit={submit}
      scope="commercial"
      withholding={completed}
    />,
  )
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByLabelText('Número del comprobante')).toHaveValue(
    '001-001-000028564',
  )
  const save = within(dialog).getByRole('button', {
    name: 'Guardar corrección',
  })
  expect(save).toBeDisabled()
  await user.type(
    within(dialog).getByLabelText('Motivo de la corrección'),
    'Número mal digitado',
  )
  await user.click(save)
  await waitFor(() => expect(submit).toHaveBeenCalled())
  expect(submit.mock.calls[0]?.[0]).toMatchObject({
    reason: 'Número mal digitado',
    operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  })
})

it('anular exige motivo y avisa que el saldo vuelve a mostrar el valor', async () => {
  const user = userEvent.setup()
  const submit = vi
    .fn()
    .mockRejectedValueOnce(new Error('La retención está anulada.'))
  const done = vi.fn()
  render(
    <VoidWithholdingDialog
      onClose={vi.fn()}
      onDone={done}
      onSubmit={submit}
      scope="commercial"
      withholding={pending}
    />,
  )
  const dialog = screen.getByRole('dialog')
  expect(
    within(dialog).getByText('El saldo volverá a mostrar este valor'),
  ).toBeInTheDocument()
  const save = within(dialog).getByRole('button', { name: 'Anular retención' })
  expect(save).toBeDisabled()
  await user.type(
    within(dialog).getByLabelText('Motivo'),
    'Registrada por error',
  )
  await user.click(save)
  await waitFor(() => expect(submit).toHaveBeenCalled())
  expect(submit.mock.calls[0]?.[0]).toBe('Registrada por error')
  expect(done).not.toHaveBeenCalled()
  expect(
    await within(dialog).findByText(/No se pudo|anulada|Revise/),
  ).toBeInTheDocument()
})

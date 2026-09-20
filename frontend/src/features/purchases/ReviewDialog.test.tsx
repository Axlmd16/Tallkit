import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { ReviewDialog } from './ReviewDialog'
import type { PurchaseReview } from './types'

const review = (over: Partial<PurchaseReview> = {}): PurchaseReview => ({
  purchase_id: 1,
  state: 'DRAFT',
  version: 1,
  can_confirm: true,
  issues: [],
  review_token: 't',
  expires_in_seconds: 900,
  totals: null,
  effects: [],
  matches: [
    { purchase_id: 8, state: 'CONFIRMED', internal_number: 'COM-ING-000008' },
  ],
  requires_acknowledgement: true,
  ...over,
})

function setup(value: PurchaseReview | null, onConfirm = vi.fn()) {
  render(
    <ReviewDialog
      documentType="SIN_DOCUMENTO"
      message="Cambió algo"
      onClose={vi.fn()}
      onConfirm={onConfirm}
      onReview={vi.fn()}
      pending={false}
      review={value}
      supplierName="Ocasional"
    />,
  )
  return onConfirm
}

it('una compra sin documento con coincidencias exige reconocerlas antes de confirmar', async () => {
  const onConfirm = setup(review())
  const confirm = screen.getByRole('button', { name: 'Confirmar ingreso' })
  expect(confirm).toBeDisabled()
  expect(screen.getByText(/COM-ING-000008/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox'))
  expect(confirm).toBeEnabled()
  await userEvent.click(confirm)
  expect(onConfirm).toHaveBeenCalledWith([8])
})

it('muestra los avisos y bloquea la confirmación cuando hay problemas', () => {
  setup(
    review({
      can_confirm: false,
      requires_acknowledgement: false,
      matches: [],
      issues: [
        {
          code: 'inactive_reference',
          field: 'supplier_id',
          message: 'El proveedor está inactivo.',
        },
      ],
    }),
  )
  expect(screen.getByText('Cambió algo')).toBeInTheDocument()
  expect(screen.getByText(/El proveedor está inactivo/)).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Confirmar ingreso' }),
  ).toBeDisabled()
})

it('sin revisión no se abre el diálogo', () => {
  setup(null)
  expect(screen.queryByRole('dialog')).toBeNull()
})

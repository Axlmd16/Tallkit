import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn() }))
vi.mock('./hooks', () => ({
  useSaleMutations: () => ({
    preview: { mutateAsync: mocks.preview },
    confirm: { mutateAsync: mocks.confirm },
  }),
}))

import { SaleReviewDialog } from './SaleReviewDialog'
import type { Sale } from './types'

const sale = { id: 4, version: 3 } as Sale
const ok = {
  sale_id: 4,
  state: 'DRAFT',
  version: 3,
  can_confirm: true,
  issues: [],
  review_token: 'tok',
  expires_in_seconds: 900,
  totals: { base: '20.00', tax: '3.00', total: '23.00' },
  effects: [
    {
      product_id: 5,
      code: 'ACE-1',
      name: 'Aceite',
      quantity_to_sell: '2',
      current_quantity: '10',
      resulting_quantity: '8',
    },
  ],
  lines: [],
}

function renderDialog(onConfirmed = vi.fn()) {
  return render(
    <MemoryRouter>
      <SaleReviewDialog
        onClose={vi.fn()}
        onConfirmed={onConfirmed}
        open
        sale={sale}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.preview.mockResolvedValue(ok)
})

it('muestra importes y efecto en existencias del servidor y confirma con token y versión', async () => {
  mocks.confirm.mockResolvedValue({ id: 4 })
  const onConfirmed = vi.fn()
  renderDialog(onConfirmed)
  await screen.findByText('USD 23.00')
  expect(screen.getByText(/10 → 8/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  await waitFor(() => expect(onConfirmed).toHaveBeenCalled())
  expect(mocks.confirm.mock.calls[0]?.[0]).toMatchObject({
    id: 4,
    expectedVersion: 3,
    reviewToken: 'tok',
  })
  expect(mocks.confirm.mock.calls[0]?.[0].key).toMatch(/^[0-9a-f-]{36}$/)
})

it('las incidencias por línea bloquean confirmar y conservan el borrador', async () => {
  mocks.preview.mockResolvedValue({
    ...ok,
    can_confirm: false,
    review_token: null,
    issues: [
      {
        code: 'inactive_reference',
        field: 'lines.1.product_id',
        message: 'El producto está inactivo.',
      },
    ],
  })
  renderDialog()
  await screen.findByText(/Línea 2: El producto está inactivo./)
  expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
  expect(screen.getByText(/Su borrador se conserva/)).toBeInTheDocument()
})

it('review_required ofrece revisar de nuevo sin perder la captura', async () => {
  mocks.confirm.mockRejectedValue(
    new ProblemError('Los importes cambiaron', 409, 'review_required'),
  )
  renderDialog()
  await screen.findByText('USD 23.00')
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  await screen.findByText('Los datos cambiaron desde la revisión')
  mocks.preview.mockClear()
  await userEvent.click(
    screen.getByRole('button', { name: 'Revisar de nuevo' }),
  )
  await waitFor(() => expect(mocks.preview).toHaveBeenCalledTimes(1))
})

it('stale_record no sobrescribe: ofrece recargar la venta guardada', async () => {
  mocks.confirm.mockRejectedValue(
    new ProblemError('Desactualizada', 409, 'stale_record'),
  )
  renderDialog()
  await screen.findByText('USD 23.00')
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
  await screen.findByText('La venta cambió desde que la abrió')
  expect(screen.getByText(/Su captura no se sobrescribió/)).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Recargar venta guardada' }),
  ).toHaveAttribute('href', '/sales/4/edit')
})

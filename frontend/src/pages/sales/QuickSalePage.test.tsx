import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type { CheckoutExecuteResponse } from '@/features/checkout/types'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  draftPreview: vi.fn(),
  productOptions: vi.fn(),
}))

const PRODUCT = {
  id: 7,
  code: 'PF-100',
  name: 'Pastillas de freno',
  unit_name: 'Unidad',
  unit_symbol: 'u',
  unit_price: '23.00',
  is_kit: false,
}

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({
    data: { username: 'ana', permissions: ['clientes.gestionar'] },
  }),
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useBusinessName: () => 'Almacén',
}))
vi.mock('@/features/sales/hooks', () => ({
  useCustomerOptions: (term: string) => ({
    data: {
      results: term
        ? [
            {
              id: 3,
              name: 'Carlos Mendoza',
              identification_type: 'Cédula',
              identification: '0912345678',
              phone: '',
              email: 'cmendoza@correo.com',
            },
          ]
        : [],
    },
  }),
  useProductOptions: (term: string) => ({
    data: { results: term ? [PRODUCT] : [] },
  }),
}))
vi.mock('@/features/sales/api', () => ({
  salesApi: {
    draftPreview: mocks.draftPreview,
    productOptions: mocks.productOptions,
  },
}))
vi.mock('@/features/checkout/api', () => ({
  checkoutApi: {
    execute: mocks.execute,
  },
}))

import { QuickSalePage } from './QuickSalePage'

const paidPrepared: CheckoutExecuteResponse = {
  overall_status: 'completed',
  origin_kind: 'QUICK_SALE',
  commercial: {
    executed: true,
    sale_id: 31,
    document_number: 'COM-VEN-000031',
    confirmed: true,
    paid: true,
    paid_amount: '23.00',
    fiscal_state: 'PREPARED',
    preparation_id: 'prep-31',
  },
  artisan: { executed: false },
  customer_email_updated: false,
  order_closure: { requested: false, closed: false, reason: null },
  replayed: false,
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <QuickSalePage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole('textbox', { name: 'Buscar cliente' }),
    'carl',
  )
  await user.click(
    await screen.findByRole('button', { name: /Carlos Mendoza/ }),
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Buscar producto' }),
    'PF-100{Enter}',
  )
  await screen.findByText('Pastillas de freno')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.productOptions.mockResolvedValue({ results: [PRODUCT] })
  mocks.draftPreview.mockResolvedValue({
    lines: [{ position: 1, total_amount: '23.00' }],
    totals: { base: '20.00', tax: '3.00', total: '23.00' },
  })
  mocks.execute.mockResolvedValue(paidPrepared)
})

it('el total sale de la vista previa del servidor', async () => {
  const user = userEvent.setup()
  renderPage()
  await fill(user)
  await waitFor(() => {
    expect(screen.getAllByText(/23\.00/).length).toBeGreaterThanOrEqual(1)
  })
})

it('cobra y prepara factura en un paso usando QUICK_SALE y ofrece recibo', async () => {
  const user = userEvent.setup()
  renderPage()
  await fill(user)

  await user.click(screen.getByRole('button', { name: 'Cobrar y facturar' }))

  await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1))
  const [input] = mocks.execute.mock.calls[0] as [
    { origin_kind: string; payment_mode: string; include_invoices: boolean },
  ]
  expect(input.origin_kind).toBe('QUICK_SALE')
  expect(input.payment_mode).toBe('CASH')
  expect(input.include_invoices).toBe(true)

  expect(
    await screen.findByText('Factura preparada (sin enviar)'),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Imprimir recibo' }),
  ).toHaveAttribute('href', '/sales/31/document')
})

it('permite Solo cobrar cuando se borra el correo', async () => {
  const user = userEvent.setup()
  mocks.execute.mockResolvedValue({
    ...paidPrepared,
    commercial: { ...paidPrepared.commercial, fiscal_state: 'SKIPPED' },
  })
  renderPage()
  await fill(user)

  const emailInput = screen.getByLabelText('Correo para la factura')
  await user.clear(emailInput)

  expect(
    screen.getByRole('button', { name: 'Escribe el correo para facturar' }),
  ).toBeDisabled()
  await user.click(
    screen.getByRole('button', { name: 'Solo cobrar (facturar después)' }),
  )

  await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1))
  const [input] = mocks.execute.mock.calls[0] as [{ include_invoices: boolean }]
  expect(input.include_invoices).toBe(false)
})

it('«Queda debiendo» envía modo CREDIT con plazo de 30 días', async () => {
  const user = userEvent.setup()
  mocks.execute.mockResolvedValue({
    ...paidPrepared,
    commercial: { ...paidPrepared.commercial, paid: false, paid_amount: '0.00' },
  })
  renderPage()
  await fill(user)

  await user.click(screen.getByRole('button', { name: 'Queda debiendo' }))
  await user.click(
    screen.getByRole('button', { name: 'Registrar a crédito y facturar' }),
  )

  await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1))
  const [input] = mocks.execute.mock.calls[0] as [
    { payment_mode: string; credit_term_days: number },
  ]
  expect(input.payment_mode).toBe('CREDIT')
  expect(input.credit_term_days).toBe(30)
})

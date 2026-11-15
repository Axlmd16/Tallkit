import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
  registerPayment: vi.fn(),
  paymentPreview: vi.fn(),
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
  useSession: () => ({ data: { username: 'ana' } }),
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
            },
          ]
        : [],
    },
  }),
  useProductOptions: (term: string) => ({
    data: { results: term ? [PRODUCT] : [] },
  }),
  useSaleMutations: () => ({
    create: { mutateAsync: mocks.create },
    preview: { mutateAsync: mocks.preview },
    confirm: { mutateAsync: mocks.confirm },
    registerPayment: { mutateAsync: mocks.registerPayment },
  }),
}))
vi.mock('@/features/sales/api', () => ({
  salesApi: {
    draftPreview: mocks.draftPreview,
    paymentPreview: mocks.paymentPreview,
    productOptions: mocks.productOptions,
  },
}))

import { QuickSalePage } from './QuickSalePage'

const confirmed = {
  id: 31,
  version: 2,
  internal_number: 'COM-VEN-000031',
  grand_total: '46.00',
  money: { balance: '46.00' },
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
  // El lector de códigos escribe el código y pulsa Intro.
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
  mocks.create.mockResolvedValue({ id: 31, version: 1 })
  mocks.preview.mockResolvedValue({
    can_confirm: true,
    review_token: 'r1',
    issues: [],
  })
  mocks.confirm.mockResolvedValue(confirmed)
  mocks.paymentPreview.mockResolvedValue({ review_token: 'p1', issues: [] })
  mocks.registerPayment.mockResolvedValue({ id: 5 })
})

it('no deja cobrar sin cliente ni productos', () => {
  renderPage()
  expect(
    screen.getByRole('button', { name: 'Elija al cliente' }),
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Efectivo' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

it('el total sale de la vista previa del servidor', async () => {
  const user = userEvent.setup()
  renderPage()
  await fill(user)
  const total = screen.getByRole('heading', { name: 'Total a cobrar' })
  await waitFor(() =>
    expect(total.parentElement).toHaveTextContent('USD 23.00'),
  )
  expect(mocks.draftPreview).toHaveBeenCalledWith(
    expect.objectContaining({
      customer_id: 3,
      condition: 'CONTADO',
      lines: [{ product_id: 7, quantity: '1' }],
    }),
  )
})

it('cobra en efectivo: confirma, registra el cobro y ofrece el recibo', async () => {
  const user = userEvent.setup()
  renderPage()
  await fill(user)
  await user.click(screen.getByRole('button', { name: 'Cobrar' }))
  expect(
    await screen.findByRole('heading', {
      name: /Venta COM-VEN-000031 cobrada/,
    }),
  ).toBeVisible()
  expect(mocks.registerPayment).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 31,
      parts: [{ method: 'EFECTIVO', amount: '46.00' }],
    }),
  )
  expect(screen.getByRole('link', { name: 'Imprimir recibo' })).toHaveAttribute(
    'href',
    '/sales/31/document',
  )
})

it('«Queda debiendo» registra la venta a crédito sin cobro', async () => {
  const user = userEvent.setup()
  renderPage()
  await fill(user)
  await user.click(screen.getByRole('button', { name: 'Queda debiendo' }))
  await user.click(screen.getByRole('button', { name: 'Registrar a crédito' }))
  expect(
    await screen.findByRole('heading', { name: /a crédito/ }),
  ).toBeVisible()
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ condition: 'CREDITO' }),
    }),
  )
  expect(mocks.registerPayment).not.toHaveBeenCalled()
})

it('si falla el cobro, avisa que la venta quedó confirmada y lleva a registrarlo', async () => {
  const user = userEvent.setup()
  mocks.registerPayment.mockRejectedValue(new Error('caído'))
  renderPage()
  await fill(user)
  await user.click(screen.getByRole('button', { name: 'Cobrar' }))
  const notice = await screen.findByText(/quedó confirmada, pero sin cobro/)
  expect(notice).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Registrar el cobro en la venta' }),
  ).toHaveAttribute('href', '/sales/31')
  // No se ofrece cobrar otra vez: evitaría una segunda venta.
  expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull()
})

it('agregar dos veces el mismo producto suma la cantidad y se puede quitar', async () => {
  const user = userEvent.setup()
  renderPage()
  await fill(user)
  await user.type(
    screen.getByRole('textbox', { name: 'Buscar producto' }),
    'PF-100{Enter}',
  )
  const products = screen.getByRole('region', { name: 'Productos' })
  await waitFor(() => expect(within(products).getByText('2')).toBeVisible())
  await user.click(
    screen.getByRole('button', { name: 'Quitar Pastillas de freno' }),
  )
  expect(within(products).queryByText('Pastillas de freno')).toBeNull()
})

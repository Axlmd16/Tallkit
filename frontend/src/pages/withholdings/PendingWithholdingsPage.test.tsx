import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  sales: {} as Record<string, unknown>,
  artisan: {} as Record<string, unknown>,
  salesEnabled: [] as boolean[],
  artisanEnabled: [] as boolean[],
  customerIds: [] as (number | undefined)[],
  completeSale: vi.fn(),
  voidSale: vi.fn(),
  completeArtisan: vi.fn(),
  voidArtisan: vi.fn(),
}))

vi.mock('@/features/accounts/AccountsHeader', () => ({
  AccountsHeader: () => null,
}))
vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({
    data: { username: 'u', permissions: mocks.permissions },
  }),
}))
vi.mock('@/features/sales/hooks', () => ({
  usePendingWithholdings: (
    _page: number,
    enabled: boolean,
    customerId?: number,
  ) => {
    mocks.salesEnabled.push(enabled)
    mocks.customerIds.push(customerId)
    return mocks.sales
  },
  useSaleMutations: () => ({
    completeVoucher: { mutateAsync: mocks.completeSale },
    voidWithholding: { mutateAsync: mocks.voidSale },
  }),
}))
vi.mock('@/features/maintenance/billingHooks', () => ({
  usePendingArtisanWithholdings: (_page: number, enabled: boolean) => {
    mocks.artisanEnabled.push(enabled)
    return mocks.artisan
  },
  useBillingMutations: () => ({
    completeVoucher: { mutateAsync: mocks.completeArtisan },
    voidWithholding: { mutateAsync: mocks.voidArtisan },
  }),
}))

import { PendingWithholdingsPage } from './PendingWithholdingsPage'

const base = {
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
  customer: {
    id: 1,
    name: 'DICOSIL CIA. LTDA.',
    identification: '1191721175001',
  },
  age_days: 3,
}
const page = (items: unknown[], total = '5.00') => ({
  data: {
    items,
    total_count: items.length,
    page: 1,
    page_size: 20,
    pending_total: total,
  },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
})

function show(scope: 'commercial' | 'artesanal') {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <PendingWithholdingsPage scope={scope} />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.salesEnabled = []
  mocks.artisanEnabled = []
  mocks.customerIds = []
  mocks.permissions = ['pagos_comerciales.ver', 'pagos_comerciales.registrar']
  mocks.sales = page([
    {
      ...base,
      id: 3,
      sale_id: 7,
      sale_number: 'COM-VEN-000007',
      fiscal_scope: 'COMERCIAL',
    },
  ])
  mocks.artisan = page([
    {
      ...base,
      id: 9,
      service_operation_id: 4,
      operation_number: 'ART-SER-000004',
      fiscal_scope: 'ARTESANAL',
    },
  ])
})

it('lista solo las retenciones comerciales y permite completar el comprobante', async () => {
  const user = userEvent.setup()
  mocks.completeSale.mockResolvedValue({})
  show('commercial')
  expect(mocks.salesEnabled.at(-1)).toBe(true)
  expect(mocks.artisanEnabled.at(-1)).toBe(false)
  expect(
    screen.getByRole('heading', { name: 'Retenciones por completar' }),
  ).toBeInTheDocument()
  const row = screen.getByRole('listitem', {
    name: 'Retención de COM-VEN-000007',
  })
  expect(within(row).getByText('DICOSIL CIA. LTDA.')).toBeInTheDocument()
  expect(within(row).getByText(/hace 3 días/)).toBeInTheDocument()
  expect(
    within(row).getByRole('link', { name: 'COM-VEN-000007' }),
  ).toHaveAttribute('href', '/sales/7')
  expect(screen.queryByText('ART-SER-000004')).toBeNull()
  expect(
    within(row).queryByRole('button', { name: 'Anular retención' }),
  ).toBeNull()

  await user.click(
    within(row).getByRole('button', { name: 'Completar comprobante' }),
  )
  const dialog = screen.getByRole('dialog')
  await user.type(
    within(dialog).getByLabelText('Número del comprobante'),
    '001-001-000028564',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar comprobante' }),
  )
  await waitFor(() => expect(mocks.completeSale).toHaveBeenCalled())
  expect(mocks.completeSale.mock.calls[0]?.[0]).toMatchObject({
    id: 7,
    withholdingId: 3,
    voucherNumber: '001-001-000028564',
  })
  expect(mocks.completeArtisan).not.toHaveBeenCalled()
})

it('en el taller usa las operaciones artesanales y el Administrador puede anular', async () => {
  const user = userEvent.setup()
  mocks.permissions = ['pagos_artesanales.ver', 'pagos_artesanales.anular']
  mocks.voidArtisan.mockResolvedValue({})
  show('artesanal')
  expect(mocks.artisanEnabled.at(-1)).toBe(true)
  expect(mocks.salesEnabled.at(-1)).toBe(false)
  const row = screen.getByRole('listitem', {
    name: 'Retención de ART-SER-000004',
  })
  expect(
    within(row).getByRole('link', { name: 'ART-SER-000004' }),
  ).toHaveAttribute('href', '/maintenance/service-operations/4')
  expect(
    within(row).queryByRole('button', { name: 'Completar comprobante' }),
  ).toBeNull()
  await user.click(
    within(row).getByRole('button', { name: 'Anular retención' }),
  )
  const dialog = screen.getByRole('dialog')
  await user.type(
    within(dialog).getByLabelText('Motivo'),
    'Registrada por error',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Anular retención' }),
  )
  await waitFor(() => expect(mocks.voidArtisan).toHaveBeenCalled())
  expect(mocks.voidArtisan.mock.calls[0]?.[0]).toMatchObject({
    id: 4,
    withholdingId: 9,
    reason: 'Registrada por error',
  })
})

it('presenta carga, error recuperable y estado vacío', async () => {
  const user = userEvent.setup()
  mocks.sales = { data: undefined, isPending: true, isError: false }
  const first = show('commercial')
  expect(screen.getByText('Cargando retenciones…')).toBeInTheDocument()
  first.unmount()

  const refetch = vi.fn()
  mocks.sales = { data: undefined, isPending: false, isError: true, refetch }
  const second = show('commercial')
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(refetch).toHaveBeenCalled()
  second.unmount()

  mocks.sales = page([], '0.00')
  show('commercial')
  expect(screen.getByText('Nada por completar')).toBeInTheDocument()
})

it('filtra por el cliente de una fila y permite volver a ver todos', async () => {
  const user = userEvent.setup()
  show('commercial')
  expect(mocks.customerIds.at(-1)).toBeUndefined()
  await user.click(
    screen.getByRole('button', { name: 'Ver solo este cliente' }),
  )
  expect(mocks.customerIds.at(-1)).toBe(1)
  const filter = screen.getByRole('group', { name: 'Filtro por cliente' })
  expect(within(filter).getByText('DICOSIL CIA. LTDA.')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Ver solo este cliente' }),
  ).toBeNull()
  await user.click(
    within(filter).getByRole('button', { name: 'Ver todos los clientes' }),
  )
  expect(mocks.customerIds.at(-1)).toBeUndefined()
})

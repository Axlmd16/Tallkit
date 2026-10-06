import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  query: {} as Record<string, unknown>,
  focusOwner: null as unknown,
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({
    data: { username: 'vendedor', permissions: mocks.permissions },
  }),
}))
vi.mock('@/features/sales/hooks', () => ({
  useSale: () => mocks.query,
  useSaleMutations: () => ({
    completeVoucher: { mutateAsync: vi.fn() },
    correctVoucher: { mutateAsync: vi.fn() },
    voidWithholding: { mutateAsync: vi.fn() },
  }),
}))
vi.mock('@/features/fiscal', () => ({ FiscalPreparationLink: () => null }))

vi.mock('@/features/sales/PaymentDialog', async () => ({
  PaymentDialog: (await import('./dialog-stub')).dialogStub('Cobro'),
}))
vi.mock('@/features/sales/ReturnDialog', async () => ({
  ReturnDialog: (await import('./dialog-stub')).dialogStub('Devolución'),
}))
vi.mock('@/features/sales/VoidSaleDialog', async () => ({
  VoidSaleDialog: (await import('./dialog-stub')).dialogStub('Anulación'),
}))
vi.mock('@/features/sales/CorrectionDialog', async () => ({
  CorrectionDialog: (await import('./dialog-stub')).dialogStub('Corrección'),
}))
vi.mock('@/features/sales/RefundDialog', async () => ({
  RefundDialog: (await import('./dialog-stub')).dialogStub('Reembolso'),
}))

import { SaleDetailPage } from './SaleDetailPage'

const sale = {
  id: 7,
  state: 'CONFIRMED',
  version: 4,
  condition: 'CREDITO',
  notes: '',
  internal_number: 'COM-VEN-000007',
  customer: { id: 1, name: 'Ana Pérez' },
  operational_date: '2026-09-20',
  grand_total: '100.00',
  base_total: '86.96',
  tax_total: '13.04',
  void_reason: '',
  lines: [
    {
      id: 11,
      position: 1,
      product_id: 5,
      product_code: 'ACE-1',
      product_name: 'Aceite',
      quantity: '5',
      returned_quantity: '2',
      unit_price: '20.00',
      total_amount: '100.00',
    },
  ],
  money: {
    exigible: '60.00',
    returned_total: '40.00',
    paid_total: '100.00',
    refunded_total: '0.00',
    applied: '100.00',
    balance: '0.00',
    refund_due: '40.00',
    payment_state: 'PAID',
  },
  payments: [
    {
      id: 1,
      operation_id: 'a',
      amount: '60.00',
      effective_date: '2026-09-20',
      parts: [{ method: 'EFECTIVO', amount: '60.00' }],
      state: 'CORRECTED',
      correction: { reason: 'Medio equivocado', replacement_payment_id: 2 },
    },
    {
      id: 2,
      operation_id: 'b',
      amount: '100.00',
      effective_date: '2026-09-20',
      parts: [{ method: 'TRANSFERENCIA', amount: '100.00' }],
      state: 'ACTIVE',
      correction: null,
    },
  ],
  returns: [
    {
      id: 4,
      operation_id: 'c',
      reason: 'Producto equivocado',
      grand_total: '40.00',
      effective_date: '2026-09-20',
    },
  ],
  refunds: [],
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/sales/7']}>
        <Routes>
          <Route element={<SaleDetailPage />} path="/sales/:id" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  mocks.permissions = [
    'ventas.ver',
    'pagos_comerciales.ver',
    'pagos_comerciales.registrar',
  ]
  mocks.query = {
    isPending: false,
    isError: false,
    data: sale,
    refetch: vi.fn(),
  }
})

it('separa estado de la venta, estado de pago y documento interno en campos distintos', () => {
  renderPage()
  const states = screen.getByRole('region', { name: 'Estados' })
  expect(
    within(states).getByText('Estado de la venta').nextElementSibling,
  ).toHaveTextContent('Confirmada')
  expect(
    within(states).getByText('Estado de pago').nextElementSibling,
  ).toHaveTextContent('Pagada')
  expect(
    within(states).getByText('Documento interno').nextElementSibling,
  ).toHaveTextContent('COM-VEN-000007')
  // El ámbito fiscal lo muestra la barra superior del marco; la ficha no lo duplica.
  expect(screen.queryByText('RUC comercial')).toBeNull()
})

it('distingue saldo cobrable y exceso por reembolsar sin llamarlo saldo a favor', () => {
  renderPage()
  const money = screen.getByRole('region', { name: 'Importes' })
  expect(
    within(money).getByText('Saldo pendiente de cobro').nextElementSibling,
  ).toHaveTextContent('USD 0.00')
  expect(
    within(money).getByText('Exceso por reembolsar').nextElementSibling,
  ).toHaveTextContent('USD 40.00')
  expect(money).toHaveTextContent(
    'no es un saldo a favor ni una deuda del cliente',
  )
})

it('muestra las líneas históricas y su cantidad devuelta en filas etiquetadas', () => {
  renderPage()
  expect(
    screen.getByRole('columnheader', { name: 'Devueltas' }),
  ).toBeInTheDocument()
  const line = screen.getByRole('row', { name: 'Línea 1' })
  expect(line).toHaveTextContent('ACE-1 · Aceite')
  expect(line).toHaveTextContent('USD 20.00')
})

it('el historial distingue el pago corregido del vigente y su motivo', () => {
  renderPage()
  expect(screen.getByRole('group', { name: 'Cobro 1' })).toHaveTextContent(
    'Corregido (no cuenta como cobro vigente)',
  )
  expect(screen.getByRole('group', { name: 'Cobro 1' })).toHaveTextContent(
    'Motivo de corrección: Medio equivocado',
  )
  expect(screen.getByRole('group', { name: 'Cobro 2' })).toHaveTextContent(
    'Vigente',
  )
})

it('un Vendedor no ve acciones administrativas y no puede cobrar sin saldo', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: 'Registrar cobro' })).toBeNull() // saldo 0
  expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Registrar devolución' }),
  ).toBeNull()
  expect(screen.queryByRole('button', { name: /Corregir pago/ })).toBeNull()
})

it('el Administrador ve corrección, devolución, reembolso y anulación', () => {
  mocks.permissions = [
    ...mocks.permissions,
    'pagos_comerciales.anular',
    'ventas.devolver',
    'ventas.anular',
  ]
  renderPage()
  expect(
    screen.getByRole('button', { name: 'Registrar devolución' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Anular venta' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Corregir pago 2' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Corregir pago 1' })).toBeNull() // ya corregido
  expect(
    screen.getByRole('button', {
      name: 'Registrar reembolso de la devolución 4',
    }),
  ).toBeInTheDocument()
})

it('el cobro se ofrece solo con saldo y permiso, y devuelve el foco al botón que lo abrió', async () => {
  mocks.query = {
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    data: {
      ...sale,
      money: {
        ...sale.money,
        balance: '30.00',
        refund_due: '0.00',
        payment_state: 'PARTIAL',
      },
    },
  }
  renderPage()
  const button = screen.getByRole('button', { name: 'Registrar cobro' })
  await userEvent.click(button)
  const dialog = screen.getByRole('dialog', { name: 'Cobro' })
  expect(dialog).toHaveAttribute('data-opener', 'Registrar cobro')
  await userEvent.click(screen.getByRole('button', { name: 'Terminar Cobro' }))
  // La confirmación es una notificación temporal, no una franja fija.
  expect(screen.getByText('Cobro registrado.')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('una venta en borrador enlaza a la edición y no muestra comprobante ni cobros', () => {
  mocks.permissions = ['ventas.ver', 'ventas.crear']
  mocks.query = {
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    data: {
      ...sale,
      state: 'DRAFT',
      internal_number: null,
      money: { ...sale.money, payment_state: null },
      payments: undefined,
      returns: [],
    },
  }
  renderPage()
  expect(screen.getByRole('link', { name: 'Editar borrador' })).toHaveAttribute(
    'href',
    '/sales/7/edit',
  )
  expect(screen.queryByRole('link', { name: 'Ver comprobante' })).toBeNull()
  expect(screen.getByText('Sin número (borrador)')).toBeInTheDocument()
})

it('presenta carga y error recuperable', async () => {
  mocks.query = { isPending: true, isError: false }
  const first = renderPage()
  expect(screen.getByText('Cargando venta…')).toBeInTheDocument()
  first.unmount()
  const refetch = vi.fn()
  mocks.query = { isPending: false, isError: true, refetch }
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(refetch).toHaveBeenCalled()
})

it('sin permiso de valoración no solicita ni muestra costos', () => {
  renderPage()
  expect(document.body.textContent?.toLowerCase()).not.toMatch(/costo|cost/)
})

it('abre y cierra devolución, anulación, corrección y reembolso desde sus acciones', async () => {
  mocks.permissions = [
    'ventas.ver',
    'pagos_comerciales.anular',
    'ventas.devolver',
    'ventas.anular',
  ]
  renderPage()
  for (const [button, dialog] of [
    ['Registrar devolución', 'Devolución'],
    ['Anular venta', 'Anulación'],
    ['Corregir pago 2', 'Corrección'],
    ['Registrar reembolso de la devolución 4', 'Reembolso'],
  ] as const) {
    await userEvent.click(screen.getByRole('button', { name: button }))
    expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: `Cerrar ${dialog}` }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  }
})

it('una venta vinculada enlaza a su orden y no ofrece anulación', () => {
  mocks.permissions = [...mocks.permissions, 'ventas.anular', 'ventas.devolver']
  mocks.query = {
    ...mocks.query,
    data: {
      ...sale,
      origin: {
        type: 'MAINTENANCE',
        order_id: 9,
        order_number: 'ART-OT-000009',
      },
    },
  }
  renderPage()
  expect(
    screen.getByText('Venta vinculada a ART-OT-000009'),
  ).toBeInTheDocument()
  expect(screen.getByText(/no puede anularse/)).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Ver orden de origen' }),
  ).toHaveAttribute('href', '/maintenance/9/commercial')
  expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Registrar devolución' }),
  ).toBeInTheDocument()
})

it('muestra lo retenido aparte del dinero cobrado y sus acciones por permiso', async () => {
  const user = userEvent.setup()
  mocks.query = {
    data: {
      ...sale,
      money: {
        ...sale.money,
        exigible: '250.00',
        paid_total: '245.00',
        withheld_total: '5.00',
        withheld_excess: '0.00',
        balance: '0.00',
        refund_due: '0.00',
      },
      withholdings: [
        {
          id: 3,
          operation_id: 'w',
          payment_id: 2,
          amount: '5.00',
          effective_at: '2026-09-20T10:00:00Z',
          effective_date: '2026-09-20',
          state: 'ACTIVE',
          void_reason: null,
          voided_at: null,
          voucher_pending: true,
          voucher_number: null,
          voucher_date: null,
          income_tax_amount: null,
          vat_amount: null,
        },
      ],
    },
    isPending: false,
    isError: false,
  }
  mocks.permissions = [
    'ventas.ver',
    'pagos_comerciales.ver',
    'pagos_comerciales.registrar',
  ]
  renderPage()
  const amounts = screen.getByRole('region', { name: 'Importes' })
  expect(within(amounts).getByText('Cobrado en dinero')).toBeInTheDocument()
  expect(
    within(amounts).getByText('Retenido por el cliente'),
  ).toBeInTheDocument()

  const section = screen.getByRole('region', { name: 'Retenciones recibidas' })
  expect(within(section).getByText('Comprobante pendiente')).toBeInTheDocument()
  expect(
    within(section).getByRole('link', {
      name: 'Ver retenciones por completar',
    }),
  ).toHaveAttribute('href', '/sales/withholdings')
  expect(
    within(section).queryByRole('button', { name: 'Anular retención' }),
  ).toBeNull()
  await user.click(
    within(section).getByRole('button', { name: 'Completar comprobante' }),
  )
  expect(
    screen.getByRole('dialog', { name: 'Completar comprobante' }),
  ).toBeInTheDocument()
})

it('sin retenciones no muestra la fila ni la sección', () => {
  renderPage()
  expect(screen.queryByText('Retenido por el cliente')).toBeNull()
  expect(
    screen.queryByRole('region', { name: 'Retenciones recibidas' }),
  ).toBeNull()
})

const quoteComparison = {
  proforma_id: 4,
  proforma_number: 'COM-PRO-000004',
  products: [
    {
      product_id: 5,
      product_code: 'ACE-1',
      product_name: 'Aceite',
      status: 'CHANGED',
      changes: ['unit_price'],
      quoted: {
        quantity: '1',
        unit_price: '10.00',
        tax_rate: '15',
        base_amount: '8.70',
        tax_amount: '1.30',
        total_amount: '10.00',
      },
      current: {
        quantity: '1',
        unit_price: '12.00',
        tax_rate: '15',
        base_amount: '10.43',
        tax_amount: '1.57',
        total_amount: '12.00',
      },
    },
  ],
  totals: {
    quoted: { base: '8.70', tax: '1.30', total: '10.00' },
    current: { base: '10.43', tax: '1.57', total: '12.00' },
    difference: '2.00',
  },
  has_differences: true,
}

const fromProforma = {
  type: 'PROFORMA',
  order_id: null,
  order_number: null,
  proforma_id: 4,
  proforma_number: 'COM-PRO-000004',
}

it('una venta de origen proforma enlaza la oferta y compara lo cotizado con la venta', () => {
  mocks.permissions = [...mocks.permissions, 'proformas.ver', 'ventas.anular']
  mocks.query = {
    ...mocks.query,
    data: { ...sale, origin: fromProforma, quote_comparison: quoteComparison },
  }
  renderPage()
  const section = screen.getByRole('region', { name: 'Origen proforma' })
  expect(
    within(section).getByRole('link', { name: 'COM-PRO-000004' }),
  ).toHaveAttribute('href', '/proformas/4')
  expect(within(section).getByText('Cambió precio')).toBeInTheDocument()
  expect(within(section).getAllByText('USD 12.00').length).toBeGreaterThan(0)
  expect(within(section).getByText('USD 2.00')).toBeInTheDocument()
  expect(within(section).queryByRole('textbox')).toBeNull()
  // No es una venta vinculada a un mantenimiento: conserva el flujo comercial normal.
  expect(screen.queryByText(/Venta vinculada a/)).toBeNull()
})

it('sin permiso de proformas el número de la oferta se muestra sin enlace', () => {
  mocks.query = {
    ...mocks.query,
    data: { ...sale, origin: fromProforma, quote_comparison: quoteComparison },
  }
  renderPage()
  const section = screen.getByRole('region', { name: 'Origen proforma' })
  expect(within(section).getByText('COM-PRO-000004')).toBeInTheDocument()
  expect(within(section).queryByRole('link')).toBeNull()
})

it('una venta directa no muestra origen proforma', () => {
  renderPage()
  expect(screen.queryByRole('region', { name: 'Origen proforma' })).toBeNull()
})
